"use client";

import { useState } from "react";
import {
  Package,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Calendar,
  Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/watson/ui/card";
import { Button } from "@/components/watson/ui/button";
import { Input } from "@/components/watson/ui/input";
import { Badge } from "@/components/watson/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/watson/ui/table";
import { PromotionItem } from "@/types/watson/promotion";

interface PromotionSidebarProps {
  promotionItems: PromotionItem[];
  onAddItem: (item: PromotionItem) => void;
  onUpdateItem: (itemCode: string, updates: Partial<PromotionItem>) => void;
  onDeleteItem: (itemCode: string) => void;
  onResetToDefault: () => void;
}

export function PromotionSidebar({
  promotionItems,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onResetToDefault,
}: PromotionSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PromotionItem>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newItem, setNewItem] = useState<Partial<PromotionItem>>({
    itemCode: "",
    itemName: "",
    stdPrice: 0,
    promoPrice: null,
    promoStart: null,
    promoEnd: null,
  });

  // Filter items by search
  const filteredItems = promotionItems.filter(
    (item) =>
      item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Check if promo is active today
  const isPromoActive = (item: PromotionItem) => {
    if (!item.promoPrice || !item.promoStart || !item.promoEnd) return false;
    const today = new Date();
    return today >= item.promoStart && today <= item.promoEnd;
  };

  // Count active promos
  const activePromoCount = promotionItems.filter(isPromoActive).length;

  // Start editing
  const handleStartEdit = (item: PromotionItem) => {
    setEditingCode(item.itemCode);
    setEditForm({
      stdPrice: item.stdPrice,
      promoPrice: item.promoPrice,
      promoStart: item.promoStart,
      promoEnd: item.promoEnd,
    });
  };

  // Save edit
  const handleSaveEdit = () => {
    if (editingCode) {
      onUpdateItem(editingCode, editForm);
      setEditingCode(null);
      setEditForm({});
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingCode(null);
    setEditForm({});
  };

  // Add new item
  const handleAddItem = () => {
    if (newItem.itemCode && newItem.itemName && newItem.stdPrice) {
      onAddItem({
        itemCode: newItem.itemCode,
        itemName: newItem.itemName,
        stdPrice: newItem.stdPrice,
        promoPrice: newItem.promoPrice || null,
        promoStart: newItem.promoStart || null,
        promoEnd: newItem.promoEnd || null,
      });
      setNewItem({
        itemCode: "",
        itemName: "",
        stdPrice: 0,
        promoPrice: null,
        promoStart: null,
        promoEnd: null,
      });
      setIsAdding(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Promotion Master
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline" className="bg-purple-50">
            {promotionItems.length} รายการ
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            <Tag className="h-3 w-3 mr-1" />
            {activePromoCount} โปรโมชั่น active
          </Badge>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Search */}
          <Input
            placeholder="ค้นหารหัส/ชื่อสินค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-sm"
          />

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAdding(!isAdding)}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              เพิ่ม
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onResetToDefault}
              title="Reset to default"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Add New Item Form */}
          {isAdding && (
            <div className="p-3 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
              <p className="text-sm font-medium text-blue-700">
                เพิ่มสินค้าใหม่
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="รหัสสินค้า"
                  value={newItem.itemCode || ""}
                  onChange={(e) =>
                    setNewItem({ ...newItem, itemCode: e.target.value })
                  }
                  className="text-xs"
                />
                <Input
                  placeholder="ชื่อสินค้า"
                  value={newItem.itemName || ""}
                  onChange={(e) =>
                    setNewItem({ ...newItem, itemName: e.target.value })
                  }
                  className="text-xs"
                />
                <Input
                  type="number"
                  placeholder="ราคา STD"
                  value={newItem.stdPrice || ""}
                  onChange={(e) =>
                    setNewItem({ ...newItem, stdPrice: Number(e.target.value) })
                  }
                  className="text-xs"
                />
                <Input
                  type="number"
                  placeholder="ราคาโปร (ถ้ามี)"
                  value={newItem.promoPrice || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      promoPrice: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="text-xs"
                />
                <Input
                  type="date"
                  placeholder="เริ่มโปร"
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      promoStart: e.target.value
                        ? new Date(e.target.value)
                        : null,
                    })
                  }
                  className="text-xs"
                />
                <Input
                  type="date"
                  placeholder="สิ้นสุดโปร"
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      promoEnd: e.target.value
                        ? new Date(e.target.value)
                        : null,
                    })
                  }
                  className="text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddItem} className="flex-1">
                  <Check className="h-4 w-4 mr-1" />
                  บันทึก
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAdding(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="max-h-96 overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-100">
                <TableRow>
                  <TableHead className="text-xs w-20">รหัส</TableHead>
                  <TableHead className="text-xs">ชื่อ</TableHead>
                  <TableHead className="text-xs text-right w-16">STD</TableHead>
                  <TableHead className="text-xs text-right w-16">Pro</TableHead>
                  <TableHead className="text-xs w-20">ช่วงเวลา</TableHead>
                  <TableHead className="text-xs w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow
                    key={item.itemCode}
                    className={isPromoActive(item) ? "bg-green-50" : ""}
                  >
                    {editingCode === item.itemCode ? (
                      // Edit mode
                      <>
                        <TableCell className="text-xs font-mono">
                          {item.itemCode}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.itemName}
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={editForm.stdPrice || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                stdPrice: Number(e.target.value),
                              })
                            }
                            className="text-xs h-7 w-16"
                          />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="number"
                            value={editForm.promoPrice || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                promoPrice: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="text-xs h-7 w-16"
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          Edit
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleSaveEdit}
                              className="h-6 w-6 p-0"
                            >
                              <Check className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      // View mode
                      <>
                        <TableCell className="text-xs font-mono">
                          {item.itemCode}
                        </TableCell>
                        <TableCell
                          className="text-xs truncate max-w-24"
                          title={item.itemName}
                        >
                          {item.itemName}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {item.stdPrice}
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          {item.promoPrice ? (
                            <span className="text-green-600 font-medium">
                              {item.promoPrice}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.promoStart && item.promoEnd ? (
                            <span
                              className={
                                isPromoActive(item)
                                  ? "text-green-600"
                                  : "text-gray-400"
                              }
                              title={`${formatDate(item.promoStart)} - ${formatDate(item.promoEnd)}`}
                            >
                              {isPromoActive(item) ? "🟢" : "⚪"}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEdit(item)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeleteItem(item.itemCode)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>🟢 = โปรโมชั่น active วันนี้</p>
            <p>⚪ = มีโปรแต่ยังไม่ถึง/หมดแล้ว</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
