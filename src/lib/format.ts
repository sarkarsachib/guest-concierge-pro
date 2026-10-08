import bebinca from "@/assets/menu/bebinca.jpg";
import biryani from "@/assets/menu/biryani.jpg";
import butterChicken from "@/assets/menu/butter-chicken.jpg";
import fishCurry from "@/assets/menu/fish-curry.jpg";
import paneer from "@/assets/menu/paneer.jpg";
import prawns from "@/assets/menu/prawns.jpg";

export const HOTEL_SLUG = "beach-view";

export const money = (n: number | string) => `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;

export const menuImages: Record<string, string> = {
  bebinca, biryani, "butter-chicken": butterChicken, "fish-curry": fishCurry, paneer, prawns,
};

export const moduleMeta: Record<string, { label: string; emoji: string; blurb: string }> = {
  restaurant: { label: "Dine", emoji: "restaurant", blurb: "In-room dining" },
  housekeeping: { label: "Housekeeping", emoji: "housekeeping", blurb: "Towels, cleaning, turndown" },
  spa: { label: "Spa", emoji: "spa", blurb: "Massages & rituals" },
  laundry: { label: "Laundry", emoji: "laundry", blurb: "Wash, press, dry-clean" },
  minibar: { label: "Minibar", emoji: "minibar", blurb: "Restock your fridge" },
  taxi: { label: "Taxi", emoji: "taxi", blurb: "Airport & local rides" },
  experiences: { label: "Experiences", emoji: "experiences", blurb: "Tours & adventures" },
  celebrations: { label: "Celebrations", emoji: "celebrations", blurb: "Cakes, flowers, décor" },
  maintenance: { label: "Maintenance", emoji: "maintenance", blurb: "Something not working?" },
};

export const STATUS_STEPS = ["received", "assigned", "on_the_way", "delivered"] as const;
export const statusLabel: Record<string, string> = {
  received: "Request received", assigned: "Staff assigned", preparing: "Preparing",
  on_the_way: "On the way", delivered: "Delivered", completed: "Completed", cancelled: "Cancelled",
  pending_approval: "Waiting for hotel approval",
};
