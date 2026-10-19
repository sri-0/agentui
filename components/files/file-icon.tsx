import {
  FileAudioIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileTypeIcon,
  FileVideoIcon,
  type LucideProps,
} from "lucide-react";

/** A file's icon, by its media type: the Files page, # references and
 *  attachments show the same one. */
export function FileKindIcon({ mediaType, ...props }: { mediaType?: string } & LucideProps) {
  const type = mediaType ?? "";
  const Icon = type.startsWith("image/")
    ? FileImageIcon
    : type.startsWith("audio/")
      ? FileAudioIcon
      : type.startsWith("video/")
        ? FileVideoIcon
        : type === "application/pdf"
          ? FileTypeIcon
          : type.startsWith("text/") || type.includes("json")
            ? FileTextIcon
            : FileIcon;
  return <Icon {...props} />;
}

/** A byte count as people read it: 812 B, 14 KB, 3.2 MB. */
export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
