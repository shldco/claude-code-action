#!/usr/bin/env bun

/**
 * Check if the action trigger is from a human actor
 * Prevents automated tools or bots from triggering Claude
 */

import type { Octokit } from "@octokit/rest";
import type { GitHubContext } from "../context";

export async function checkHumanActor(
  octokit: Octokit,
  githubContext: GitHubContext,
) {
  const allowedBots = githubContext.inputs.allowedBots;
  const botName = githubContext.actor.toLowerCase().replace(/\[bot\]$/, "");

  // Check allowed bots list before making API calls, since some bot actors
  // (e.g., "Copilot") don't exist as GitHub users and will 404
  if (allowedBots.trim() === "*") {
    // We still need to check if this is actually a bot, so fall through to API check
  } else if (allowedBots) {
    const allowedBotsList = allowedBots
      .split(",")
      .map((bot) =>
        bot
          .trim()
          .toLowerCase()
          .replace(/\[bot\]$/, ""),
      )
      .filter((bot) => bot.length > 0);

    if (allowedBotsList.includes(botName)) {
      console.log(
        `Bot ${botName} is in allowed list, skipping human actor check`,
      );
      return;
    }
  }

  // Fetch user information from GitHub API
  let userData;
  try {
    const response = await octokit.users.getByUsername({
      username: githubContext.actor,
    });
    userData = response.data;
  } catch (error: any) {
    if (error.status === 404) {
      // Actor doesn't exist as a GitHub user (e.g., "Copilot")
      // If all bots are allowed, let it through
      if (allowedBots.trim() === "*") {
        console.log(
          `All bots are allowed, skipping human actor check for: ${githubContext.actor}`,
        );
        return;
      }
      throw new Error(
        `Workflow initiated by unknown actor: ${githubContext.actor} (not found as a GitHub user). Add to allowed_bots list or use '*' to allow all bots.`,
      );
    }
    throw error;
  }

  const actorType = userData.type;

  console.log(`Actor type: ${actorType}`);

  // Check bot permissions if actor is not a User
  if (actorType !== "User") {
    // Check if all bots are allowed
    if (allowedBots.trim() === "*") {
      console.log(
        `All bots are allowed, skipping human actor check for: ${githubContext.actor}`,
      );
      return;
    }

    // Bot not allowed (we already checked the allowed list above)
    throw new Error(
      `Workflow initiated by non-human actor: ${botName} (type: ${actorType}). Add bot to allowed_bots list or use '*' to allow all bots.`,
    );
  }

  console.log(`Verified human actor: ${githubContext.actor}`);
}
