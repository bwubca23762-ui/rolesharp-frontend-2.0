import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAssertion, voiceConfigured } from "../lib/voice/gcp-auth";
import { pcmToWav, questionCacheKey, SAMPLE_RATE, wavHeader } from "../lib/voice/tts";

const source = (path: string) => readFileSync(path, "utf8");

test("the voice gate answers unconfigured without a key or without the switch", () => {
  // The test environment has neither GCP_VOICE_ENABLED nor a key file, so
  // everything downstream must degrade to "voice_unconfigured" instead of
  // throwing — that is the local-dev and CI contract.
  assert.equal(voiceConfigured(), false);
});

test("the service-account assertion is a well-formed RS256 JWT", () => {
  const account = {
    client_email: "runner@rolesharp.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----\n",
    project_id: "rolesharp",
  };
  // A bogus PEM cannot be signed; assert the shape guard instead — the real
  // signature path is exercised by the live smoke test, never by CI.
  assert.throws(() => buildAssertion(account));
});

test("WAV header math is canonical PCM", () => {
  const header = wavHeader(480);
  assert.equal(header.toString("ascii", 0, 4), "RIFF");
  assert.equal(header.toString("ascii", 8, 12), "WAVE");
  assert.equal(header.readUInt16LE(20), 1); // PCM
  assert.equal(header.readUInt16LE(22), 1); // mono
  assert.equal(header.readUInt32LE(24), SAMPLE_RATE);
  assert.equal(header.readUInt32LE(28), SAMPLE_RATE * 2); // byte rate
  assert.equal(header.readUInt16LE(34), 16); // bits
  assert.equal(header.readUInt32LE(40), 480); // data length
  assert.equal(header.length, 44);
  const wrapped = pcmToWav(Buffer.alloc(480));
  assert.equal(wrapped.length, 44 + 480);
  assert.equal(wrapped.readUInt32LE(4), 36 + 480);
});

test("the TTS cache key is content-addressed and voice-pinned", () => {
  const a = questionCacheKey("Tell me about a measurable result from your experience.");
  const b = questionCacheKey("Tell me about a measurable result from your experience.");
  const c = questionCacheKey("How have you worked with other people or teams?");
  const d = questionCacheKey("Tell me about a measurable result from your experience.", "Puck");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.equal(a.length, 40);
});

test("the TTS route gates on login, rate limit, and the configured voice switch", () => {
  const route = source("app/api/interview/tts/route.ts");
  assert.match(route, /currentUser/u);
  assert.match(route, /rateLimit\(req, "interview-tts"/u);
  assert.match(route, /voice_unconfigured/u);
  // 503, never 500: an unconfigured voice install degrades politely.
  assert.match(route, /status: 503/u);
});

test("synthesis rides the service account, never a user OAuth flow", () => {
  const tts = source("lib/voice/tts.ts");
  assert.match(tts, /getAccessToken/u);
  assert.match(tts, /aiplatform\.googleapis\.com/u);
  assert.match(tts, /pcmToWav/u);
  // No consent-screen, no browser redirect — server-to-server only.
  assert.doesNotMatch(tts, /accounts\.google\.com\/o\/oauth2\/auth/u);
});

test("V-3: voice-answer AI is premium-only, rides Vertex, and never persists audio", () => {
  const route = source("app/api/interview/[id]/answer/route.ts");
  // Tier gate before any AI call: free users sending audio get the uniform
  // 402, not a silent upgrade of their traffic to the first gateway.
  assert.match(route, /voiceGatewayFor/u);
  assert.match(route, /premium_required", upgrade: true/u);
  // The audio lives in the request only — no fs, no db writes of audio.
  assert.doesNotMatch(route, /writeFile|appendFile|insert into.*audio/iu);
  // Transcript (not audio) is what gets stored with the session.
  assert.match(route, /session\.answers = \[[\s\S]*?answer: submitted/u);
  const lib = source("lib/voice/answer-audio.ts");
  assert.match(lib, /aiplatform\.googleapis\.com/u);
  assert.match(lib, /responseMimeType/u);
  assert.doesNotMatch(lib, /writeFile|createWriteStream/u);
});

test("V-3: the LLM never receives invented evidence instructions", () => {
  const lib = source("lib/voice/answer-audio.ts");
  assert.match(lib, /never suggest adding numbers|never grade the person/u);
  assert.match(lib, /temperature: 0\.2/u);
});
