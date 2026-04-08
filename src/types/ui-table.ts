import type { ReactNode } from "react";

export type FilterDefinition = {
  id: string;
  label: string;
  value: string;
  removable?: boolean;
};

export type RowActionDefinition<RowType> = {
  id: string;
  label: string;
  onClick: (row: RowType) => void;
  isDisabled?: (row: RowType) => boolean;
};

export type TableColumn<RowType> = {
  id: string;
  header: string;
  width?: string;
  isNumeric?: boolean;
  render: (row: RowType) => ReactNode;
};
