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

            // Using the exact model name found in your successful diagnostic log
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(`Gemini API Error: ${data.error?.message || JSON.stringify(data)}`);
            }

            return data;
        });

// The extraction logic remains the same
        const part = response.candidates?.[0]?.content?.parts?.[0];
        const introText = (part && 'text' in part ? part.text : null) || 'Welcome to Stockify! We are excited to help you track your financial journey.';

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