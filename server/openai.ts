import OpenAI from "openai";

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. Do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DataAnalysisRequest {
  chartType: string;
  dataPoints: any[];
  dateRange?: { from: string; to: string };
  metric: string;
}

export async function generateInsight(data: DataAnalysisRequest): Promise<string> {
  try {
    console.log("[OPENAI] Starting insight generation with data:", JSON.stringify(data, null, 2));
    
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("[OPENAI] API key is not set in environment variables");
      return "عذراً، لم نتمكن من توليد تحليل للبيانات. مفتاح API غير متوفر.";
    }
    
    const prompt = `
You are an expert data analyst for an installer rewards program designed for Arabic-speaking technicians.
Analyze the following data and provide a concise, meaningful insight in Arabic (use Arabic script).
Keep your response to 2-3 sentences maximum.

Chart Type: ${data.chartType}
Time Period: ${data.dateRange ? `From ${data.dateRange.from} to ${data.dateRange.to}` : 'All time'}
Metric: ${data.metric}
Data Points: ${JSON.stringify(data.dataPoints)}

Generate a data-driven insight that:
1. Identifies patterns, trends, or anomalies
2. Provides context or explanation for observed patterns
3. Makes a simple, actionable recommendation if appropriate

Your response should be direct, insightful, and in Arabic language. Don't include phrases like "Based on the data" or "The analysis shows" - just provide the insight directly.
`;

    console.log("[OPENAI] Sending request for chart insight with prompt:", prompt);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    const insight = response.choices[0].message.content?.trim() || '';
    console.log("[OPENAI] Generated insight:", insight);
    
    return insight;
  } catch (error: any) {
    console.error("[OPENAI] Error generating insight:", error);
    
    // Log more details about the error
    if (error.response) {
      console.error("[OPENAI] Error response status:", error.response.status);
      console.error("[OPENAI] Error response data:", error.response.data);
    }
    
    return "عذراً، لم نتمكن من توليد تحليل للبيانات في هذا الوقت.";
  }
}

export async function generateAnalyticsSummary(data: any): Promise<string> {
  try {
    console.log("[OPENAI] Starting summary generation with data:", JSON.stringify(data, null, 2));
    
    // Check if API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error("[OPENAI] API key is not set in environment variables");
      return "عذراً، لم نتمكن من توليد ملخص للبيانات. مفتاح API غير متوفر.";
    }
    
    const prompt = `
You are an expert data analyst for an installer rewards program designed for Arabic-speaking technicians.
Generate a comprehensive summary in Arabic of the current state of the program based on the following dashboard metrics:

Total Installers: ${data.totalInstallers}
Total Installations: ${data.totalInstallations}
Points Awarded: ${data.pointsAwarded}
Points Redeemed: ${data.pointsRedeemed}
Installations by Region: ${JSON.stringify(data.regionData)}
Products Installed: ${JSON.stringify(data.productData)}
Time Period: ${data.dateRange ? `From ${data.dateRange.from} to ${data.dateRange.to}` : 'All time'}

Your response should be in Arabic and include:
1. A concise overview of program performance
2. Key patterns or insights
3. 1-2 recommendations for program improvement

Keep your response to about 4 sentences, use Arabic script.
`;

    console.log("[OPENAI] Sending request for dashboard summary with prompt:", prompt);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 250,
      temperature: 0.7,
    });

    const summary = response.choices[0].message.content?.trim() || '';
    console.log("[OPENAI] Generated summary:", summary);
    
    return summary;
  } catch (error: any) {
    console.error("[OPENAI] Error generating summary:", error);
    
    // Log more details about the error
    if (error.response) {
      console.error("[OPENAI] Error response status:", error.response.status);
      console.error("[OPENAI] Error response data:", error.response.data);
    }
    
    return "عذراً، لم نتمكن من توليد ملخص للبيانات في هذا الوقت.";
  }
}