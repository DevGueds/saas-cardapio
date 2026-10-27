import { z } from "zod"

// Browser validation must work with script-src 'self', including lazy schemas.
// Keep this entry before application imports; server validation retains its own policy.
z.config({ jitless: true })
