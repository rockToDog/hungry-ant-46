const kv = await Deno.openKv();

export async function getPeer() {
  const entries = kv.list({ prefix: ["peers"] });
  const res = [];
  for await (const entry of entries) {
    res.push(entry.value);
  }
  return res;
}

export async function setPeer(user: string, peer: string) {
  await kv.set(["peers", user], peer);
}
