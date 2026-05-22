function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round(n) {
  return Math.round(n);
}

function avg(arr, fallback) {
  if (!arr || arr.length === 0) return fallback;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

function pickTitle(matchIndex) {
  if (matchIndex >= 90) return "Destined Sync Duo";
  if (matchIndex >= 80) return "High-Density Soulmates";
  if (matchIndex >= 65) return "Comfortably In-Sync";
  if (matchIndex >= 50) return "Complement Watchlist";
  return "Contrast Relationship Specimen";
}

function pickSubtitle(matchIndex) {
  if (matchIndex >= 90) return "Same frequency, different skins.";
  if (matchIndex >= 80) return "You click fast—and it shows.";
  if (matchIndex >= 65) return "Easy vibes with room to grow.";
  if (matchIndex >= 50) return "Different energy, interesting potential.";
  return "Spicy contrast: handle with care.";
}

function pickDescription(matchIndex, weakestDimLabel) {
  const dimName = weakestDimLabel || "one area";
  if (matchIndex >= 90) return "Your answers line up like you planned it. The chemistry feels natural, and the rhythm stays steady even when things get busy.";
  if (matchIndex >= 80) return "Strong alignment with just enough difference to keep it fun. You’ll feel seen, and the vibe stays warm when you hang out.";
  if (matchIndex >= 65) return `Overall stable and comfy. If you tune your approach in “${dimName}”, you’ll become that duo everyone wants to join.`;
  if (matchIndex >= 50) return `There’s real complement energy here. The key is to set tiny rules early, especially around “${dimName}”.`;
  return `Your differences are loud—sometimes that’s exactly the plot. Start slow, keep expectations clear, and protect “${dimName}” from turning into drama.`;
}

function pickAdvice(weakestDimKey, weakestDimLabel) {
  const dimName = weakestDimLabel || "the tricky part";
  if (weakestDimKey === "life") {
    return "Advice: Agree on tiny logistics early (timing, budget, planning). Keep it light: one person chooses, the other sets boundaries. You’ll avoid most avoidable stress.";
  }
  if (weakestDimKey === "emotion") {
    return "Advice: Use a simple rule—state feelings + state needs. If one of you goes quiet, the other gives space, then checks in. Clarity beats guessing.";
  }
  return `Advice: Make fun intentional. Pick one shared activity to repeat (a game, a café, a route). Consistency turns chemistry into a real rhythm—especially for “${dimName}”.`;
}

function typeScore(type, aScore, bScore) {
  const diff = Math.abs(aScore - bScore);
  if (type === "similarity") {
    if (diff === 0) return 100;
    if (diff === 1) return 72;
    if (diff === 2) return 40;
    return 10;
  }
  if (type === "complement") {
    if (diff === 1) return 92;
    if (diff === 0) return 78;
    if (diff === 2) return 78;
    return 55;
  }
  if (type === "conflict") {
    if (diff === 0) return 100;
    if (diff === 1) return 80;
    if (diff === 2) return 42;
    return 8;
  }
  return 70;
}

function computePairResult(questions, hostAnswers, guestAnswers, dimensionLabels) {
  const byType = { similarity: [], complement: [], conflict: [] };
  const byDim = { life: [], emotion: [], fun: [] };
  const perQuestion = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const ha = hostAnswers?.[i];
    const ga = guestAnswers?.[i];
    if (!Number.isInteger(ha) || !Number.isInteger(ga)) continue;
    if (ha < 0 || ha > 3 || ga < 0 || ga > 3) continue;
    const hs = q.scores[ha];
    const gs = q.scores[ga];
    const s = typeScore(q.type, hs, gs);

    if (byType[q.type]) byType[q.type].push(s);
    if (byDim[q.dimension]) byDim[q.dimension].push(s);

    perQuestion.push({
      id: q.id,
      dimension: q.dimension,
      type: q.type,
      score: s,
      hostOpt: q.options[ha],
      guestOpt: q.options[ga],
      prompt: q.prompt,
      diff: Math.abs(hs - gs)
    });
  }

  const similarityScore = avg(byType.similarity, 78);
  const complementScore = avg(byType.complement, 78);
  const conflictScore = avg(byType.conflict, 78);
  const matchIndex = clamp(round(similarityScore * 0.5 + complementScore * 0.3 + conflictScore * 0.2), 0, 100);

  const dimScores = {
    life: clamp(round(avg(byDim.life, 75)), 0, 100),
    emotion: clamp(round(avg(byDim.emotion, 75)), 0, 100),
    fun: clamp(round(avg(byDim.fun, 75)), 0, 100)
  };

  const dimsSorted = Object.entries(dimScores).sort((a, b) => a[1] - b[1]);
  const weakestDimKey = dimsSorted[0]?.[0] || "life";
  const strongestDimKey = dimsSorted[dimsSorted.length - 1]?.[0] || "fun";
  const weakestDimLabel = dimensionLabels?.[weakestDimKey] || weakestDimKey;

  const strengths = perQuestion
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => {
      const bothSame = x.hostOpt === x.guestOpt;
      if (bothSame) return `Both chose: “${x.hostOpt}”.`;
      return `You align on “${String(x.prompt || "").toLowerCase()}” in a surprisingly compatible way.`;
    });

  const frictions = perQuestion
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((x) => `Different picks on “${String(x.prompt || "").toLowerCase()}” (${x.hostOpt} vs ${x.guestOpt}).`);

  const title = pickTitle(matchIndex);
  const subtitle = pickSubtitle(matchIndex);
  const description = pickDescription(matchIndex, weakestDimLabel);
  const advice = pickAdvice(weakestDimKey, weakestDimLabel);

  return {
    similarityScore: clamp(round(similarityScore), 0, 100),
    complementScore: clamp(round(complementScore), 0, 100),
    conflictScore: clamp(round(conflictScore), 0, 100),
    matchIndex,
    dimScores,
    weakestDimKey,
    strongestDimKey,
    strengths,
    frictions,
    title,
    subtitle,
    description,
    advice
  };
}

function computeRoomAggregate(pairResults, dimensionLabels) {
  const pairs = Array.isArray(pairResults) ? pairResults : [];
  if (pairs.length === 0) return null;

  const similarityScore = avg(pairs.map((p) => p.similarityScore), 78);
  const complementScore = avg(pairs.map((p) => p.complementScore), 78);
  const conflictScore = avg(pairs.map((p) => p.conflictScore), 78);
  const matchIndex = clamp(round(avg(pairs.map((p) => p.matchIndex), 0)), 0, 100);

  const dimScores = {
    life: clamp(round(avg(pairs.map((p) => p.dimScores?.life ?? 75), 75)), 0, 100),
    emotion: clamp(round(avg(pairs.map((p) => p.dimScores?.emotion ?? 75), 75)), 0, 100),
    fun: clamp(round(avg(pairs.map((p) => p.dimScores?.fun ?? 75), 75)), 0, 100)
  };

  const dimsSorted = Object.entries(dimScores).sort((a, b) => a[1] - b[1]);
  const weakestDimKey = dimsSorted[0]?.[0] || "life";
  const strongestDimKey = dimsSorted[dimsSorted.length - 1]?.[0] || "fun";
  const weakestDimLabel = dimensionLabels?.[weakestDimKey] || weakestDimKey;

  const title = pickTitle(matchIndex);
  const subtitle = pickSubtitle(matchIndex);
  const description = pickDescription(matchIndex, weakestDimLabel);
  const advice = pickAdvice(weakestDimKey, weakestDimLabel);

  return {
    similarityScore: clamp(round(similarityScore), 0, 100),
    complementScore: clamp(round(complementScore), 0, 100),
    conflictScore: clamp(round(conflictScore), 0, 100),
    matchIndex,
    dimScores,
    weakestDimKey,
    strongestDimKey,
    title,
    subtitle,
    description,
    advice,
    guestAnsweredCount: pairs.length
  };
}

module.exports = {
  computePairResult,
  computeRoomAggregate
};

