'use server';

/**
 * @fileOverview Automatically generates meaningful group names based on the data in an XLSX file.
 *
 * - generateGroupName - A function that generates a group name.
 * - GenerateGroupNameInput - The input type for the generateGroupName function.
 * - GenerateGroupNameOutput - The return type for the generateGroupName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateGroupNameInputSchema = z.object({
  dataSummary: z
    .string()
    .describe('A summary of the data that will be contained in the group.'),
  groupNumber: z.number().describe('The number of the group being named.'),
  numberOfGroups: z.number().describe('The total number of groups.'),
});
export type GenerateGroupNameInput = z.infer<typeof GenerateGroupNameInputSchema>;

const GenerateGroupNameOutputSchema = z.object({
  groupName: z.string().describe('The generated name for the group.'),
});
export type GenerateGroupNameOutput = z.infer<typeof GenerateGroupNameOutputSchema>;

export async function generateGroupName(input: GenerateGroupNameInput): Promise<GenerateGroupNameOutput> {
  return generateGroupNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateGroupNamePrompt',
  input: {schema: GenerateGroupNameInputSchema},
  output: {schema: GenerateGroupNameOutputSchema},
  prompt: `You are an expert at naming groups of data based on a summary of the data they contain.  You will generate a concise, meaningful name for the group.

  The group is number {{groupNumber}} out of {{numberOfGroups}}.

  Data Summary: {{{dataSummary}}}`,
});

const generateGroupNameFlow = ai.defineFlow(
  {
    name: 'generateGroupNameFlow',
    inputSchema: GenerateGroupNameInputSchema,
    outputSchema: GenerateGroupNameOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
