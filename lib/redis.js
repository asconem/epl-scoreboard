import { Redis } from "@upstash/redis";
import { OWNERS, OWNER_CONFIG_VERSION } from "./pool-config";

const KEY = "epl2627:board";
const CONFIGURED_NAMES = Object.fromEntries(
  Object.entries(OWNERS).map(([stable, name]) => [stable, name || ""])
);
const EMPTY = {
  version: 0,
  matches: [],
  names: CONFIGURED_NAMES,
  ownerConfigVersion: OWNER_CONFIG_VERSION,
  seasonComplete: false,
};

function normalizeBoard(board) {
  if (!board || board.ownerConfigVersion !== OWNER_CONFIG_VERSION) {
    return { ...EMPTY, ...board, names: { ...CONFIGURED_NAMES }, ownerConfigVersion: OWNER_CONFIG_VERSION };
  }
  const savedNames = board?.names || {};
  const names = { ...CONFIGURED_NAMES, ...savedNames, "5": "The Leftovers" };
  return { ...EMPTY, ...board, names, ownerConfigVersion: OWNER_CONFIG_VERSION };
}

function client() {
  return Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
}

export async function getBoardStrict() {
  const value = await client().get(KEY);
  return normalizeBoard(value);
}

export async function getBoard() {
  try { return await getBoardStrict(); }
  catch (e) { return EMPTY; }
}

export async function saveBoard(data) {
  const normalized = normalizeBoard(data);
  const payload = {
    version: Date.now(),
    matches: Array.isArray(data?.matches) ? data.matches : [],
    names: normalized.names,
    ownerConfigVersion: OWNER_CONFIG_VERSION,
    seasonComplete: !!data?.seasonComplete,
  };
  await client().set(KEY, payload);
  return payload;
}
