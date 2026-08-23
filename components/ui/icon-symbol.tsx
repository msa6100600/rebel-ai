// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconSymbolName = string;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "bubble.left.and.bubble.right.fill": "forum",
  "brain.head.profile": "psychology",
  "books.vertical.fill": "library-books",
  "checkmark.seal.fill": "verified",
  "gearshape.fill": "settings",
  "mic.fill": "mic",
  "speaker.wave.2.fill": "volume-up",
  "magnifyingglass": "search",
  "plus.circle.fill": "add-circle",
  "trash.fill": "delete",
  "sparkles": "auto-awesome",
  "arrow.up.circle.fill": "arrow-upward",
  "xmark": "close",
  "person.circle.fill": "account-circle",
  "phone.fill": "phone",
  "phone.down.fill": "call-end",
  "mic.slash.fill": "mic-off",
  "photo.fill": "image",
  "pencil": "edit",
  "globe": "public",
  "puzzlepiece.extension.fill": "extension",
  "folder.fill": "folder",
  "shield": "shield",
  "arrow.down.doc": "file-download",
  "square.grid.2x2.fill": "grid-view",
  "ellipsis.circle.fill": "more-horiz",
  "medical": "medical-services",
  "gavel": "gavel",
  "favorite": "favorite",
  "school": "school",
  "airplane": "flight",
  "code": "code",
} as Record<string, ComponentProps<typeof MaterialIcons>["name"]>;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name] ?? "help-outline"} style={style} />;
}
