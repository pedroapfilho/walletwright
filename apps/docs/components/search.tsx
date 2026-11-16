"use client";

import { useStaticSearch } from "fumadocs-core/search/client/orama-static";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from "fumadocs-ui/components/dialog/search";
import type { SharedProps } from "fumadocs-ui/contexts/search";

const StaticSearchDialog = (props: SharedProps) => {
  const { data, isLoading, onSearchChange, search } = useStaticSearch();

  return (
    <SearchDialog isLoading={isLoading} onSearchChange={onSearchChange} search={search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={data ? data.items : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
};

export { StaticSearchDialog };
