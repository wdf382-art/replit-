import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ExtractedScene {
  sceneIdentifier: string;
  sortOrder: number;
  title: string;
  location: string | null;
  timeOfDay: string | null;
  description: string | null;
  dialogue: string | null;
  action: string | null;
  scriptContent: string;
  characters: string[];
}

export interface CallSheetSceneMatch {
  callSheetReference: string;
  matchedSceneIdentifier: string;
  confidence: number;
  reason: string;
}

export async function extractScenesFromScriptWithAI(scriptContent: string): Promise<ExtractedScene[]> {
  if (!scriptContent || scriptContent.trim().length === 0) {
    console.log("[AI Scene Extract] Empty script content");
    return [];
  }

  console.log(`[AI Scene Extract] Processing script with ${scriptContent.length} characters`);

  const systemPrompt = `你是一个专业的剧本分析助手。你的任务是从剧本中识别并提取所有场次。

剧本场次的常见格式包括但不限于：
- "第X场" 或 "第X集"
- "X-Y" 格式（如 1-1, 2-3）
- "场次X"
- 场景标题行通常包含：场次号、地点、时间（日/夜）、内/外

请分析剧本内容，识别每个场次的：
1. sceneIdentifier: 场次标识符（保留原始格式，如 "1-1"、"第1场"）
2. sortOrder: 排序序号（从0开始）
3. title: 场次标题行
4. location: 拍摄地点
5. timeOfDay: 时间（日/夜/黄昏等）
6. description: 场景描述
7. dialogue: 对白内容
8. action: 动作描述（通常以△或▲开头的行）
9. scriptContent: 该场次的完整原文
10. characters: 该场次出现的角色名称列表

返回 JSON 格式，包含 scenes 数组。`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请分析以下剧本并提取所有场次：\n\n${scriptContent}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[AI Scene Extract] No response from AI");
      return [];
    }

    const parsed = JSON.parse(content);
    const scenes: ExtractedScene[] = parsed.scenes || [];
    
    console.log(`[AI Scene Extract] Extracted ${scenes.length} scenes`);
    return scenes;
  } catch (error) {
    console.error("[AI Scene Extract] Error:", error);
    return [];
  }
}

export async function matchCallSheetToScenesWithAI(
  callSheetText: string,
  existingScenes: { identifier: string; title: string; content: string }[]
): Promise<CallSheetSceneMatch[]> {
  if (!callSheetText || existingScenes.length === 0) {
    console.log("[AI CallSheet Match] Empty callsheet or no scenes");
    return [];
  }

  console.log(`[AI CallSheet Match] Matching callsheet to ${existingScenes.length} scenes`);

  const sceneSummary = existingScenes.map(s => 
    `- 标识: "${s.identifier}", 标题: "${s.title}", 内容摘要: "${s.content.substring(0, 100)}..."`
  ).join("\n");

  const systemPrompt = `你是一个专业的影视制作助手。你的任务是将通告单中提到的场次匹配到已有的剧本场次。

通告单中的场次引用可能采用不同的格式，你需要智能理解并匹配到对应的剧本场次。

请返回 JSON 格式，包含 matches 数组，每个匹配包含：
1. callSheetReference: 通告单中的原始场次引用
2. matchedSceneIdentifier: 匹配到的剧本场次标识符
3. confidence: 匹配置信度 (0-1)
4. reason: 匹配理由`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `已有场次列表：\n${sceneSummary}\n\n通告单内容：\n${callSheetText}\n\n请识别通告单中提到的所有场次，并匹配到已有场次。` 
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[AI CallSheet Match] No response from AI");
      return [];
    }

    const parsed = JSON.parse(content);
    const matches: CallSheetSceneMatch[] = parsed.matches || [];
    
    console.log(`[AI CallSheet Match] Found ${matches.length} matches`);
    return matches;
  } catch (error) {
    console.error("[AI CallSheet Match] Error:", error);
    return [];
  }
}

export async function extractSceneIdentifiersFromCallSheet(callSheetText: string): Promise<string[]> {
  if (!callSheetText) return [];

  const systemPrompt = `你是一个专业的影视制作助手。请从通告单中提取所有提到的场次编号/标识符。

返回 JSON 格式：{ "identifiers": ["1-1", "1-2", ...] }

注意：
- 保留原始格式（如 "1-1"、"第1场"、"场次1"）
- 按出现顺序排列
- 去除重复`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `请从以下通告单中提取场次编号：\n\n${callSheetText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.identifiers || [];
  } catch (error) {
    console.error("[AI Extract Identifiers] Error:", error);
    return [];
  }
}
