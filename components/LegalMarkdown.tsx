import type { ReactNode } from "react";

function inlineText(source: string): ReactNode[] {
  return source.split(/(`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/gu).filter(Boolean).map((part, index) => {
    const code = part.match(/^`([^`]+)`$/u);
    if (code) return <code key={index}>{code[1]}</code>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/u);
    if (link) return <a key={index} href={link[2]} rel="noreferrer noopener">{link[1]}</a>;
    return part;
  });
}

export default function LegalMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown.replace(/\r\n?/gu, "\n").split(/\n{2,}/u).map((block) => block.trim()).filter(Boolean);
  return <>
    {blocks.map((block, index) => {
      if (block.startsWith("## ")) return <h2 key={index}>{inlineText(block.slice(3))}</h2>;
      if (block.startsWith("### ")) return <h3 key={index}>{inlineText(block.slice(4))}</h3>;
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.every((line) => line.startsWith("- "))) {
        return <ul key={index}>{lines.map((line, itemIndex) => <li key={itemIndex}>{inlineText(line.slice(2))}</li>)}</ul>;
      }
      return <p key={index}>{inlineText(lines.join(" "))}</p>;
    })}
  </>;
}
