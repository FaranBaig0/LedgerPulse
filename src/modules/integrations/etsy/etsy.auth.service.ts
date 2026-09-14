import { ChannelPlatform } from "@prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { encryptToken } from "../../../lib/encryption.js";
import { generatePkcePair } from "../../../lib/pkce.js";
import { generateOAuthState, verifyOAuthState } from "../../../lib/oauthState.js";
import { EtsyCallbackQuery } from "./etsy.schema.js";

const ETSY_API_KEY = process.env.ETSY_API_KEY || "dummy_etsy_keystring";
const ETSY_REDIRECT_URI = process.env.ETSY_REDIRECT_URI || "http://localhost:4000/api/v1/auth/etsy/callback";
const ETSY_SCOPES = "listings_r transactions_r";

export interface EtsyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export class EtsyAuthService {
  /**
   * Generates PKCE pair and returns Etsy OAuth authorization URL
   */
  static getAuthorizationUrl(tenantId: string): string {
    const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePkcePair();
    const { state } = generateOAuthState({
      tenantId,
      platform: "ETSY",
      codeVerifier
    });

    const encodedRedirect = encodeURIComponent(ETSY_REDIRECT_URI);
    const encodedScopes = encodeURIComponent(ETSY_SCOPES);

    return `https://www.etsy.com/oauth/connect?response_type=code&client_id=${ETSY_API_KEY}&redirect_uri=${encodedRedirect}&scope=${encodedScopes}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}`;
  }

  /**
   * Handles Etsy OAuth callback using PKCE code_verifier
   */
  static async handleCallback(queryParams: EtsyCallbackQuery): Promise<{ channelId: string; storeIdentifier: string }> {
    const { code, state } = queryParams;

    // 1. Verify state and retrieve PKCE codeVerifier
    const statePayload = verifyOAuthState(state);
    if (statePayload.platform !== "ETSY") {
      throw new Error("INVALID_PLATFORM_STATE");
    }
    if (!statePayload.codeVerifier) {
      throw new Error("MISSING_PKCE_CODE_VERIFIER");
    }

    const { tenantId, codeVerifier } = statePayload;

    // 2. Exchange authorization code for tokens via Etsy v3 Token Endpoint
    const tokenUrl = "https://api.etsy.com/v3/public/oauth/token";
    const bodyParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ETSY_API_KEY,
      code,
      redirect_uri: ETSY_REDIRECT_URI,
      code_verifier: codeVerifier
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: bodyParams.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ETSY_TOKEN_EXCHANGE_FAILED: ${errorText}`);
    }

    const tokenData = (await response.json()) as EtsyTokenResponse;
    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new Error("ETSY_TOKENS_MISSING");
    }

    // 3. Extract storeIdentifier from access token prefix or fallback to user/shop ID
    const storeIdentifier = tokenData.access_token.split(".")[0] || "etsy_shop";

    // 4. Encrypt Access Token & Refresh Token using AES-256-GCM
    const encryptedToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = encryptToken(tokenData.refresh_token);
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // 5. Upsert Channel record under tenantId
    const channel = await prisma.channel.upsert({
      where: {
        tenantId_platform_storeIdentifier: {
          tenantId,
          platform: ChannelPlatform.ETSY,
          storeIdentifier
        }
      },
      update: {
        encryptedToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        platform: ChannelPlatform.ETSY,
        storeIdentifier,
        encryptedToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        isActive: true
      }
    });

    return {
      channelId: channel.id,
      storeIdentifier: channel.storeIdentifier
    };
  }

  /**
   * Direct development/sandbox channel connection when live Etsy OAuth keys are not configured
   */
  static async connectDirect(tenantId: string, storeIdentifier: string = "my-etsy-shop"): Promise<{ channelId: string; storeIdentifier: string }> {
    const encryptedToken = encryptToken("dummy_etsy_access_token");
    const encryptedRefreshToken = encryptToken("dummy_etsy_refresh_token");

    const channel = await prisma.channel.upsert({
      where: {
        tenantId_platform_storeIdentifier: {
          tenantId,
          platform: ChannelPlatform.ETSY,
          storeIdentifier
        }
      },
      update: {
        encryptedToken,
        encryptedRefreshToken,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        platform: ChannelPlatform.ETSY,
        storeIdentifier,
        encryptedToken,
        encryptedRefreshToken,
        isActive: true
      }
    });

    return {
      channelId: channel.id,
      storeIdentifier: channel.storeIdentifier
    };
  }
}
