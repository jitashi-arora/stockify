import {inngest} from "@/lib/inngest/client";
import {PERSONALIZED_WELCOME_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendWelcomeEmail} from "@/lib/nodemailer";
export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile)

        const response = await step.run('generate-welcome-intro', async () => {
            const apiKey = process.env.GEMINI_API_KEY;

            try {
                // We try the most stable version of Gemini 1.5 Flash
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    }),
                    // Set a short timeout so the whole app doesn't hang
                    signal: AbortSignal.timeout(5000)
                });

                if (res.ok) {
                    return await res.json();
                }

                // If it's a quota or 404 error, we log it but don't crash
                console.warn("AI Step failed, using fallback intro. Status:", res.status);
                return null;
            } catch (error) {
                console.error("AI Step error:", error);
                return null;
            }
        });

// Logic to extract AI text OR use a professional fallback
        const part = response?.candidates?.[0]?.content?.parts?.[0];
        const aiIntro = part && 'text' in part ? part.text : null;

        const introText = aiIntro || `
    Thanks for joining Stockify! We've analyzed your goal for <strong>${event.data.investmentGoals}</strong> 
    and your <strong>${event.data.riskTolerance}</strong> risk profile. You're now set up to track 
    real-time data in the <strong>${event.data.preferredIndustry}</strong> sector.
`;
        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText = (part && 'text' in part ? part.text : null) ||'Thanks for joining Stockify. You now have the tools to track markets and make smarter moves.'

            const { data: { email, name } } = event;

            return await sendWelcomeEmail({ email, name, intro: introText });
        })

        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)