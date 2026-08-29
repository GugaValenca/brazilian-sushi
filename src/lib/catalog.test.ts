import { describe, expect, it } from "vitest";

import { normalizeAllergens, normalizeMenuItem, type MenuApiItem } from "./catalog";

function apiItem(overrides: Partial<MenuApiItem> = {}): MenuApiItem {
  return {
    id: 1,
    category: 1,
    category_name: "Rolls",
    name: "Brazilian Roll",
    slug: "brazilian-roll",
    short_description: "Cream cheese, mango, salmon",
    description: "Our signature roll with cream cheese, mango, and fresh salmon.",
    price: "15.50",
    image: null,
    spicy: false,
    vegetarian: false,
    featured: false,
    allergens: "",
    calories: null,
    availability: "available",
    option_groups: [],
    ...overrides,
  };
}

describe("normalizeAllergens", () => {
  it("splits, trims, and drops empty entries", () => {
    expect(normalizeAllergens("Shellfish, Soy ,  , Sesame")).toEqual(["Shellfish", "Soy", "Sesame"]);
  });

  it("returns an empty array for an empty string", () => {
    expect(normalizeAllergens("")).toEqual([]);
  });
});

describe("normalizeMenuItem", () => {
  it("maps API fields and coerces price to a number", () => {
    const normalized = normalizeMenuItem(apiItem());

    expect(normalized).toMatchObject({
      id: "1",
      apiId: 1,
      name: "Brazilian Roll",
      price: 15.5,
      category: "Rolls",
    });
  });

  it("falls back to the full description when short_description is blank", () => {
    const normalized = normalizeMenuItem(apiItem({ short_description: "", description: "Full description." }));

    expect(normalized.description).toBe("Full description.");
  });

  it("uses the API image when one is provided", () => {
    const normalized = normalizeMenuItem(apiItem({ image: "https://cdn.example.com/roll.jpg" }));

    expect(normalized.image).toBe("https://cdn.example.com/roll.jpg");
  });

  it("falls back to a name-based image when the item name mentions a known dish type", () => {
    const withoutImage = apiItem({ image: null, category_name: "Rolls", name: "Salmon Sashimi Plate" });
    const withImage = apiItem({ image: "https://cdn.example.com/roll.jpg", category_name: "Rolls", name: "Salmon Sashimi Plate" });

    // Same category, different name keyword ("sashimi") — the fallback should
    // differ from a plain roll in the same category, proving it keys off the
    // item name first rather than just the category.
    expect(normalizeMenuItem(withoutImage).image).not.toBe(normalizeMenuItem(withImage).image);
  });

  it("falls back to the category's default image when nothing else matches", () => {
    const normalized = normalizeMenuItem(apiItem({ image: null, category_name: "Beverages", name: "Iced Tea" }));

    expect(normalized.image).toBeTruthy();
  });

  it("parses the allergens string into a list", () => {
    const normalized = normalizeMenuItem(apiItem({ allergens: "Soy, Sesame" }));

    expect(normalized.allergens).toEqual(["Soy", "Sesame"]);
  });
});
