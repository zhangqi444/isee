/* Where a weak ISEE maths skill is taught in the AoPS material.
 * Reference only — a pointer into books the family already owns, plus the two
 * free things (Alcumus, the Prealgebra videos). Verbal and Reading have no
 * honest AoPS equivalent, so they get nothing rather than something vague. */
import { D } from "./content"

export const AOPS_SUBJECTS = ["ma", "qr"]
export function aopsFor(sub, skill) {
  if (!D.aops || !AOPS_SUBJECTS.includes(sub)) return null
  return D.aops.skills[skill] || null
}
export const aopsFree = () => (D.aops && D.aops.free) || []
/** Alcumus has no per-topic deep link, so we send her to Alcumus and name the topic to pick. */
export const ALCUMUS_URL = "https://artofproblemsolving.com/alcumus"
export const VIDEO_URL = "https://artofproblemsolving.com/videos"
