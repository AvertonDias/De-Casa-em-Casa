
"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tag } from "lucide-react";

interface TagPopoverProps {
  tags: { tag: string; description: string }[];
  onTagClick: (tag: string) => void;
}

export function TagPopover({ tags, onTagClick }: TagPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
          <Tag className="h-4 w-4" />
          <span className="sr-only">Ver tags disponíveis</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Tags Disponíveis</h4>
            <p className="text-sm text-muted-foreground">
              Clique em uma tag para inseri-la na mensagem.
            </p>
          </div>
          <div className="grid gap-2">
            {tags.map((tagInfo) => (
              <button
                key={tagInfo.tag}
                onClick={() => onTagClick(tagInfo.tag)}
                className="grid grid-cols-3 items-center gap-4 text-left p-2 rounded-md hover:bg-accent transition-colors"
              >
                <code className="text-sm font-semibold">{tagInfo.tag}</code>
                <p className="col-span-2 text-sm text-muted-foreground">
                  {tagInfo.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
