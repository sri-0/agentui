import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";

// Configure dayjs once for the whole app. Import from here, never `dayjs`
// directly, so plugins are always available.
dayjs.extend(duration);
dayjs.extend(relativeTime);

export default dayjs;
