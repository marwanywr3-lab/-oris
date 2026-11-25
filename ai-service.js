const OrisAI = {
  async processCommand(userPrompt, state) {
    const apiKey = state.settings.apiKey?.trim();
    if (!apiKey) {
      throw new Error(I18N[state.lang].missing_api);
    }

    const model = state.settings.model || "gemini-2.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const dayNames = ["Sunday (0)", "Monday (1)", "Tuesday (2)", "Wednesday (3)", "Thursday (4)", "Friday (5)", "Saturday (6)"];
    const todayIndex = new Date().getDay();

    const systemInstruction = `
You are "Oris", a concise, intelligent daily scheduling assistant.
Current active UI language: ${state.lang === "ar" ? "Arabic" : "English"}.
Today is: ${dayNames[todayIndex]}, currently selected day index in UI: ${state.selectedDay}.
Day Index Mapping: 0=Sunday (الأحد), 1=Monday (الاثنين), 2=Tuesday (الثلاثاء), 3=Wednesday (الأربعاء), 4=Thursday (الخميس), 5=Friday (الجمعة), 6=Saturday (السبت).

User Routine Guardrails:
- Wake-up time: ${state.preferences.wakeTime}
- Bedtime: ${state.preferences.sleepTime} (DO NOT schedule tasks during sleep hours unless explicitly forced)
- Preferred Focus/Study window: ${state.preferences.focusStart} to ${state.preferences.focusEnd}
- Preferred Hobby window: ${state.preferences.hobbyStart} to ${state.preferences.hobbyEnd}

Current Existing Tasks JSON:
${JSON.stringify(state.tasks)}

You MUST respond ONLY with a valid JSON object matching this exact schema (no markdown code fences):
{
  "actions": [
    {
      "type": "ADD_TASK" | "DELETE_TASK" | "UPDATE_TASK" | "NAVIGATE",
      "task": {
        "id": "optional existing id for update/delete",
        "title": "string",
        "days": [0, 3],
        "startTime": "HH:MM (24-hour format e.g. 16:00)",
        "endTime": "HH:MM (24-hour format e.g. 17:30)",
        "category": "study" | "hobby" | "routine",
        "notes": "string"
      },
      "targetView": "today" | "week" | "preferences" | "settings",
      "targetDay": 0
    }
  ],
  "reply": "Short, friendly confirmation message in ${state.lang === "ar" ? "Arabic" : "English"}."
}

Rules:
1. If user asks to open a page or day (e.g., "افتح جدول يوم الخميس" or "open settings"), return a NAVIGATE action with targetView ("today" for a specific day, plus targetDay 0-6) or ("week", "preferences", "settings").
2. If user asks to schedule something across multiple days (e.g., "الأحد والربوع"), put [0, 3] in "days".
3. Always use 24-hour "HH:MM" format for startTime and endTime.
4. Keep "reply" brief and natural.
`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: systemInstruction + "

User Command: " + userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API Error (${response.status})`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(rawText);
  }
};
