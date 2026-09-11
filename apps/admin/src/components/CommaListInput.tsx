import { useState } from "react";
import { Input, type InputProps } from "@fluentui/react-components";

export function CommaListInput({
  items,
  onItemsChange,
  ...props
}: Omit<InputProps, "value" | "onChange" | "onBlur"> & {
  items: string[];
  onItemsChange: (items: string[]) => void;
}) {
  const [edit, setEdit] = useState({ source: items, text: items.join(", ") });
  return (
    <Input
      {...props}
      value={edit.source === items ? edit.text : items.join(", ")}
      onChange={(_, data) => {
        // A comma inside a skill such as SQL (Oracle, SQL Server) is not a separator.
        const parts: string[] = [];
        let start = 0,
          depth = 0;
        for (let i = 0; i < data.value.length; i++) {
          if (data.value[i] === "(") depth++;
          else if (data.value[i] === ")") depth = Math.max(0, depth - 1);
          else if (data.value[i] === "," && !depth) {
            parts.push(data.value.slice(start, i));
            start = i + 1;
          }
        }
        parts.push(data.value.slice(start));
        const next = parts.map((part) => part.trim()).filter(Boolean);
        // Keep the exact editing text, including its trailing comma and spaces.
        setEdit({ source: next, text: data.value });
        onItemsChange(next);
      }}
      onBlur={() => setEdit({ source: items, text: items.join(", ") })}
    />
  );
}
