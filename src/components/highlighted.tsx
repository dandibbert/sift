import { Fragment } from "react";

export function Highlighted({ text, ranges, markClassName = "text-highlight" }: { text: string; ranges: Array<[number, number]>; markClassName?: string }) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(<Fragment key={`t${i}`}>{text.slice(at, s)}</Fragment>);
    parts.push(
      <mark key={`m${i}`} className={`bg-transparent font-semibold ${markClassName}`}>
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) parts.push(<Fragment key="tail">{text.slice(at)}</Fragment>);
  return <>{parts}</>;
}
