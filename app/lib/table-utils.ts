import type { Updater } from '@tanstack/vue-table'
import type { Ref } from 'vue'
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  isFunction,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures
} from '@tanstack/vue-table'

export function valueUpdater<T>(updaterOrValue: Updater<T>, ref: Ref<T>) {
  ref.value = isFunction(updaterOrValue) ? updaterOrValue(ref.value) : updaterOrValue
}

// Features shared by the sortable, paginated data tables. The 'auto' sort only
// resolves registered functions: string columns need these two, numbers fall
// back to the built-in basic sort.
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text }
})
