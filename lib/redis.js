import { Redis } from "@upstash/redis";

const KEY = "epl2627:board";
const EMPTY = {
  version: 0,
  matches: [],
  names: { "1": "", "2": "", "3": "", "4": "", "5": "The Leftovers" },
  seasonComplete: false,
};

function normalizeBoard(board) {
  const savedNames = board?.names || {};
  const legacyNames = !savedNames["5"] && savedNames["4"] === "The Leftovers";
  const names = legacyNames
    ? { ...EMPTY.names, ...savedNames, "4": "", "5": "The Leftovers" }
    : { ...EMPTY.names, ...savedNames, "5": "The Leftovers" };
  return { ...EMPTY, ...board, names };
}

function client() {
  return Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
}

export async function getBoard() {
  try {
    const v = await client().get(KEY);
    return normalizeBoard(v);
  } catch (e) {
    return EMPTY;
  }
}

export async function saveBoard(data) {
  const payload = {
    version: Date.now(),
    matches: Array.isArray(data?.matches) ? data.matches : [],
    names: normalizeBoard(data).names,
    seasonComplete: !!data?.seasonComplete,
  };
  await client().set(KEY, payload);
  return payload;
}
