"use server";

import { generateGroupName } from "@/ai/flows/generate-group-name";
import type { GenerateGroupNameInput } from "@/ai/flows/generate-group-name";

// This action will generate names for all groups in parallel.
export async function generateGroupNamesAction(
  dataSummary: string,
  numberOfGroups: number
): Promise<string[]> {
  const nameGenerationPromises: Promise<{ groupName: string; }>[] = [];
  for (let i = 0; i < numberOfGroups; i++) {
    const input: GenerateGroupNameInput = {
      dataSummary,
      groupNumber: i + 1,
      numberOfGroups,
    };
    nameGenerationPromises.push(generateGroupName(input));
  }

  try {
    const results = await Promise.all(nameGenerationPromises);
    return results.map((result) => result.groupName);
  } catch (error) {
    console.error("Error generating group names:", error);
    // Return generic names as a fallback
    return Array.from({ length: numberOfGroups }, (_, i) => `Group ${i + 1}`);
  }
}
