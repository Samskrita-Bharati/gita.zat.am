/**
 * Upload endpoint URL is public; Cloudinary secrets MUST stay in a Worker.
 * The original Zat.am Worker may only verify tokens from its original Firebase
 * project. Deploy the GG-specific Worker in cloudflare/gg-avatar-worker.js and
 * replace this URL with the GG Worker endpoint before enabling uploads.
 * The existing worker URL must not be changed on the original website.
 */
export const AVATAR_UPLOAD_ENDPOINT =
  "https://gg-zatam-avatar-upload.ggzatam.workers.dev/avatar";
