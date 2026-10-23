export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Use POST for meal planning." })
    };
  }

  try {
    const input = JSON.parse(event.body || "{}");
    const goal = String(input.goal || "").slice(0, 100);
    const foodPreference = String(input.foodPreference || input.preference || "").slice(0, 100);
    const budget = String(input.budget || "").slice(0, 100);

    if (!goal || !foodPreference || !budget) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Please provide your goal, food preference, and budget." })
      };
    }

    if (input.age && Number(input.age) < 18) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "This planner is for adults 18 and older." })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Meal planning is temporarily unavailable. Please try again later." })
      };
    }

    const prompt = `
Create a practical, balanced meal plan for an adult. This is general food-planning information, not medical advice.

User selections:
- Goal: ${goal}
- Food preference: ${foodPreference}
- Budget: ${budget}

Requirements:
- Suggest a simple one-day meal plan with breakfast, lunch, an optional snack, and dinner.
- Use familiar, affordable ingredients and sensible portions.
- Include vegetarian alternatives when useful.
- Do not prescribe extreme calorie restriction, fasting, supplements, or guaranteed weight loss.
- Do not diagnose or treat medical conditions.
- Mention that portions should be adjusted for hunger, activity, allergies, and individual needs.
- Return clear, friendly plain text with headings.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 1200
          }
        })
      }
    );

    if (!response.ok) {
      console.error("Gemini request failed with status:", response.status);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "We couldn't generate a plan right now. Please try again shortly." })
      };
    }

    const result = await response.json();
    const plan = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n")
      .trim();

    if (!plan) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: "No meal plan was returned. Please try again." })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        plan,
        disclaimer: "General meal-planning information only, not medical advice."
      })
    };
  } catch (error) {
    console.error("Meal plan function error:", error.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "We couldn't process that request. Please check your selections and try again." })
    };
  }
  }
