export async function analyzeMarketWithGroq(recentCandles, currentPosition, currentBalance) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing Groq API key in .env.local");

  // Only send the last 20 candles to save context window and speed
  const dataForAi = recentCandles.slice(-20).map(c => ({
    time: new Date(c.time * 1000).toLocaleTimeString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close
  }));

  const prompt = `You are an elite quantitative day-trader AI.
You strictly provide output in JSON format.

Current Account Status:
- Virtual Balance: $${currentBalance.toFixed(2)}
- Current Position Holding: ${currentPosition > 0 ? currentPosition.toFixed(4) + ' Units' : 'None (Flat)'}

Recent 1-minute Candlestick Data (PAXG/USDT):
${JSON.stringify(dataForAi, null, 2)}

Task: Analyze the recent trend and decide the next immediate action.
Allowed Actions:
- "BUY" (if you believe the price will go up and we are currently Flat)
- "SELL" (if you believe the price will go down and we currently hold a Position)
- "HOLD" (if we should wait, or if we hold a position and trend is still up, or if Flat and trend is down)

Respond exactly with this JSON structure and nothing else:
{
  "action": "BUY" | "SELL" | "HOLD",
  "reason": "Brief 1-sentence analytical reason"
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
       const text = await response.text();
       console.error("Groq API error:", text);
       return { action: "HOLD", reason: "API Error: " + response.status };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return result;
  } catch (error) {
    console.error("Error asking Groq:", error);
    return { action: "HOLD", reason: "Connection to AI failed" };
  }
}
