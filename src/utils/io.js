import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function ask(question) {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function chooseFromList(title, items, labelFn) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No items available to select.");
  }

  console.log(`\n${title}`);
  items.forEach((item, index) => {
    console.log(`${index + 1}. ${labelFn(item)}`);
  });

  while (true) {
    const answer = await ask("Select a number: ");
    const selectedIndex = Number.parseInt(answer, 10) - 1;
    if (!Number.isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < items.length) {
      return items[selectedIndex];
    }
    console.log("Invalid selection. Please try again.");
  }
}

export function printHeader(title) {
  console.log("\n========================================");
  console.log(title);
  console.log("========================================");
}
