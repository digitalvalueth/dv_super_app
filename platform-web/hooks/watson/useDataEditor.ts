"use client";

import { useState, useCallback } from "react";
import { RawRow } from "@/types/watson/invoice";

interface UseDataEditorReturn {
  data: RawRow[];
  setData: (data: RawRow[]) => void;
  updateCell: (
    rowIndex: number,
    columnName: string,
    newValue: string | number | null,
  ) => void;
  deleteRow: (rowIndex: number) => void;
  shiftRowLeft: (
    rowIndex: number,
    startColIndex: number,
    headers: string[],
  ) => void;
  shiftRowRight: (
    rowIndex: number,
    startColIndex: number,
    headers: string[],
  ) => void;
  shiftColumnLeft: (colIndex: number, headers: string[]) => void;
  shiftColumnRight: (colIndex: number, headers: string[]) => void;
  clearCell: (rowIndex: number, columnName: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  historyLength: number;
}

export function useDataEditor(initialData: RawRow[] = []): UseDataEditorReturn {
  const [data, setDataState] = useState<RawRow[]>(initialData);
  const [history, setHistory] = useState<{ data: RawRow[]; action: string }[]>(
    [],
  );
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveToHistory = useCallback(
    (newData: RawRow[], action: string) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push({ data: [...data], action });
        return newHistory;
      });
      setHistoryIndex((prev) => prev + 1);
      setDataState(newData);
    },
    [data, historyIndex],
  );

  const setData = useCallback((newData: RawRow[]) => {
    setDataState(newData);
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  const updateCell = useCallback(
    (
      rowIndex: number,
      columnName: string,
      newValue: string | number | null,
    ) => {
      const newData = data.map((row, idx) => {
        if (idx === rowIndex) {
          return { ...row, [columnName]: newValue };
        }
        return row;
      });
      saveToHistory(newData, `Edit cell [${rowIndex}, ${columnName}]`);
    },
    [data, saveToHistory],
  );

  const shiftRowLeft = useCallback(
    (rowIndex: number, startColIndex: number, headers: string[]) => {
      const newData = [...data];
      const row = { ...newData[rowIndex] };

      // Collect non-empty values from startColIndex onwards
      const values: (string | number | null | undefined)[] = [];
      for (let i = startColIndex; i < headers.length; i++) {
        const value = row[headers[i]];
        if (
          value !== null &&
          value !== undefined &&
          String(value).trim() !== ""
        ) {
          values.push(value);
        }
      }

      // Fill from startColIndex with collected values
      for (let i = startColIndex; i < headers.length; i++) {
        const valueIndex = i - startColIndex;
        row[headers[i]] =
          valueIndex < values.length ? values[valueIndex] : null;
      }

      newData[rowIndex] = row;
      saveToHistory(newData, `Shift left row ${rowIndex}`);
    },
    [data, saveToHistory],
  );

  const shiftRowRight = useCallback(
    (rowIndex: number, startColIndex: number, headers: string[]) => {
      const newData = [...data];
      const row = { ...newData[rowIndex] };

      // Shift values to the right
      for (let i = headers.length - 1; i > startColIndex; i--) {
        row[headers[i]] = row[headers[i - 1]];
      }
      row[headers[startColIndex]] = null;

      newData[rowIndex] = row;
      saveToHistory(newData, `Shift right row ${rowIndex}`);
    },
    [data, saveToHistory],
  );

  // Shift entire column left for ALL rows
  const shiftColumnLeft = useCallback(
    (colIndex: number, headers: string[]) => {
      const newData = data.map((row) => {
        const newRow = { ...row };
        // Shift all values from colIndex onwards to the left
        for (let i = colIndex; i < headers.length - 1; i++) {
          newRow[headers[i]] = row[headers[i + 1]];
        }
        // Clear the last column
        newRow[headers[headers.length - 1]] = null;
        return newRow;
      });
      saveToHistory(newData, `Shift column left from ${headers[colIndex]}`);
    },
    [data, saveToHistory],
  );

  // Shift entire column right for ALL rows
  const shiftColumnRight = useCallback(
    (colIndex: number, headers: string[]) => {
      const newData = data.map((row) => {
        const newRow = { ...row };
        // Shift all values from colIndex onwards to the right
        for (let i = headers.length - 1; i > colIndex; i--) {
          newRow[headers[i]] = row[headers[i - 1]];
        }
        // Clear the current column
        newRow[headers[colIndex]] = null;
        return newRow;
      });
      saveToHistory(newData, `Shift column right from ${headers[colIndex]}`);
    },
    [data, saveToHistory],
  );

  const clearCell = useCallback(
    (rowIndex: number, columnName: string) => {
      const newData = data.map((row, idx) => {
        if (idx === rowIndex) {
          return { ...row, [columnName]: null };
        }
        return row;
      });
      saveToHistory(newData, `Clear cell [${rowIndex}, ${columnName}]`);
    },
    [data, saveToHistory],
  );

  const deleteRow = useCallback(
    (rowIndex: number) => {
      const newData = data.filter((_, idx) => idx !== rowIndex);
      saveToHistory(newData, `Delete row ${rowIndex}`);
    },
    [data, saveToHistory],
  );

  const undo = useCallback(() => {
    if (historyIndex >= 0) {
      const prevState = history[historyIndex];
      setDataState(prevState.data);
      setHistoryIndex((prev) => prev - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      // Get the data that was set after this history point
      if (nextIndex < history.length) {
        setHistoryIndex(nextIndex);
        // We need to store the "after" state, not "before"
        // For now, this is a simplified version
      }
    }
  }, [history, historyIndex]);

  return {
    data,
    setData,
    updateCell,
    deleteRow,
    shiftRowLeft,
    shiftRowRight,
    shiftColumnLeft,
    shiftColumnRight,
    clearCell,
    canUndo: historyIndex >= 0,
    canRedo: historyIndex < history.length - 1,
    undo,
    redo,
    historyLength: history.length,
  };
}
