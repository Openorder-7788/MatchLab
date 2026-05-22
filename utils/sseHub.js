function createSseHub() {
  const byRoomId = new Map();

  function add(roomId, res) {
    const set = byRoomId.get(roomId) || new Set();
    set.add(res);
    byRoomId.set(roomId, set);
  }

  function remove(roomId, res) {
    const set = byRoomId.get(roomId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) byRoomId.delete(roomId);
  }

  function send(roomId, eventType, data) {
    const set = byRoomId.get(roomId);
    if (!set || set.size === 0) return;
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of Array.from(set)) {
      try {
        res.raw.write(payload);
      } catch {}
    }
  }

  return { add, remove, send };
}

module.exports = { createSseHub };
