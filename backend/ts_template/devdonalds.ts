import express, { Request, Response } from "express";

// ==== Type Definitions, feel free to add or modify ==========================
interface cookbookEntry {
  name: string;
  type: string;
}

interface requiredItem {
  name: string;
  quantity: number;
}

interface recipe extends cookbookEntry {
  requiredItems: requiredItem[];
}

interface ingredient extends cookbookEntry {
  cookTime: number;
}

// =============================================================================
// ==== HTTP Endpoint Stubs ====================================================
// =============================================================================
const app = express();
app.use(express.json());

// Store your recipes here!
const cookbook: Map<string, cookbookEntry> = new Map();

// Task 1 helper (don't touch)
app.post("/parse", (req:Request, res:Response) => {
  const { input } = req.body;

  const parsed_string = parse_handwriting(input)
  if (parsed_string == null) {
    res.status(400).send("this string is cooked");
    return;
  } 
  res.json({ msg: parsed_string });
  return;
  
});

// [TASK 1] ====================================================================
// Takes in a recipeName and returns it in a form that 
const parse_handwriting = (recipeName: string): string | null => {
  // remove all non-letter characters besides whitespace, hyphen, underscore
  recipeName = recipeName.replace(/[^a-zA-Z\s-_]/g, ""); 
  
  recipeName = recipeName
    .split(/[\s_-]+/) // split into words (by whitespace, hyphen, or underscore)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // capitalise
    .join(" "); // rejoin words with spaces

  // trim leading or trailing whitespace, return null if this results in empty string
  if ((recipeName.trim()).length <= 0) {
    return null;
  }

  return recipeName;
}

// [TASK 2] ====================================================================
// Endpoint that adds a CookbookEntry to your magical cookbook
app.post("/entry", (req:Request, res:Response) => {
  const entry: cookbookEntry = req.body;

  if (entry.type !== "recipe" && entry.type !== "ingredient") {
    return res.status(400).send();
  }

  // ensure entry names are unique
  if (cookbook.has(entry.name)) {
    return res.status(400).json({ error: `Entry name '${entry.name}' already exists in cookbook` });
  }

  if (entry.type === "ingredient") {
    if ((entry as ingredient).cookTime < 0 || !Number.isInteger((entry as ingredient).cookTime)) {
      return res.status(400).json({ error: "Invalid ingredient cookTime" });
    }
  } else if (entry.type === "recipe") {
    const seenItemNames = new Set<string>();
    for (const item of (entry as recipe).requiredItems) {
      if (seenItemNames.has(item.name)) {
        return res.status(400).json({ 
          error: `requiredItems includes >1 element of name '${item.name}'`});
      }
      seenItemNames.add(item.name);

      // validate quantity of item
      if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        return res.status(400).json({ error: "Invalid item quantity" });
      }
    }
  } else { // type is not "recipe" or "ingredient"
    return res.status(400).json({ error: "Invalid entry type" }); 
  }

  // store the entry
  cookbook.set(entry.name, entry);
  return res.status(200).send();
});

// [TASK 3] ====================================================================
// Endpoint that returns a summary of a recipe that corresponds to a query name
app.get("/summary", (req:Request, res:Request) => {
  const recipeName: string = req.query.name as string;

  if (!recipeName || typeof recipeName !== "string") {
    return res.status(400).json({ error: "Invalid recipe name"});
  }
  
  const entry = cookbook.get(recipeName);

  if (!entry || entry.type !== "recipe") {
    return res.status(400).json({ error: `Recipe name '${recipeName}' not found`});
  }

  try {
    const summary = makeRecipeSummary(entry as recipe);
    return res.status(200).json({
      name: recipeName,
      cookTime: summary.cookTime,
      ingredients: summary.ingredients,
    });
  } catch (error) {
    return res.status(400).json({ error: 'Failed to create recipe summary'});
  }
});

const makeRecipeSummary = (recipe: recipe): { cookTime: number; ingredients: requiredItem[] } => {
  let totalCookTime = 0;
  const ingredientMap: Map<string, number> = new Map(); // maps name, quantity of ingredients

  for (const item of recipe.requiredItems) {
    const entry = cookbook.get(item.name);
    if (!entry) {
      throw new Error(`Required item ${item.name} not found`);
    }

    if (entry.type === "ingredient") {
      totalCookTime += (entry as ingredient).cookTime * item.quantity;
      // adjust item quantity on ingredientMap 
      ingredientMap.set(item.name, (ingredientMap.get(item.name) || 0) + item.quantity);

    } else if (entry.type === "recipe") {
      // recursive call breaks down the current item (a subrecipe) into base ingredients
      const subSummary = makeRecipeSummary(entry as recipe); 
      totalCookTime += subSummary.cookTime * item.quantity;

      for (const subIngredient of subSummary.ingredients) {
        ingredientMap.set(
          subIngredient.name,
          (ingredientMap.get(subIngredient.name) || 0) + subIngredient.quantity * item.quantity
        );
      }
    } 
  }
  return {
    cookTime: totalCookTime,
    ingredients: Array.from(ingredientMap, ([name, quantity]) => ({ name, quantity }))
  };
}
// =============================================================================
// ==== DO NOT TOUCH ===========================================================
// =============================================================================
const port = 8080;
app.listen(port, () => {
  console.log(`Running on: http://127.0.0.1:8080`);
});
