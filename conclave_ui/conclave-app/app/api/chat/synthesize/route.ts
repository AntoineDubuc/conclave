/**
 * Synthesis API
 *
 * Non-streaming endpoint that synthesizes a discovery conversation transcript
 * into a clean, actionable task description for the Configure step.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { SYNTHESIS_SYSTEM_PROMPT } from "@/lib/flows/defaults";

// =============================================================================
// Types
// =============================================================================

interface RequestBody {
  transcript: string;
  model: string;
  provider: "anthropic" | "openai" | "google" | "xai";
  apiKey?: string;
}

// =============================================================================
// Provider Clients (same factories as discovery endpoint)
// =============================================================================

function getAnthropicClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  });
}

function getOpenAIClient(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  });
}

function getGoogleClient(apiKey?: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY || "");
}

function getXAIClient(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || process.env.XAI_API_KEY,
    baseURL: "https://api.x.ai/v1",
  });
}

// =============================================================================
// Provider Handlers (non-streaming, return full text)
// =============================================================================

async function synthesizeAnthropic(
  client: Anthropic,
  model: string,
  transcript: string
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0.3,
    system: SYNTHESIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: transcript }],
  });

  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

async function synthesizeOpenAI(
  client: OpenAI,
  model: string,
  transcript: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    temperature: 0.3,
    messages: [
      { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
      { role: "user", content: transcript },
    ],
  });

  return response.choices[0]?.message?.content || "";
}

async function synthesizeGoogle(
  client: GoogleGenerativeAI,
  model: string,
  transcript: string
): Promise<string> {
  const genModel = client.getGenerativeModel({
    model,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
    systemInstruction: SYNTHESIS_SYSTEM_PROMPT,
  });

  const result = await genModel.generateContent(transcript);
  return result.response.text();
}

// =============================================================================
// Route Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { transcript, model, provider, apiKey } = body;

    // Validate required fields
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json(
        { error: "Missing or empty transcript" },
        { status: 400 }
      );
    }

    if (!model || !provider) {
      return NextResponse.json(
        { error: "Missing required fields: model, provider" },
        { status: 400 }
      );
    }

    let task: string;

    switch (provider) {
      case "anthropic": {
        const client = getAnthropicClient(apiKey);
        task = await synthesizeAnthropic(client, model, transcript);
        break;
      }
      case "openai": {
        const client = getOpenAIClient(apiKey);
        task = await synthesizeOpenAI(client, model, transcript);
        break;
      }
      case "google": {
        const client = getGoogleClient(apiKey);
        task = await synthesizeGoogle(client, model, transcript);
        break;
      }
      case "xai": {
        const client = getXAIClient(apiKey);
        task = await synthesizeOpenAI(client, model, transcript);
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Synthesis error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
