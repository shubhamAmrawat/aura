import { useSaveSheetTarget } from "../lib/CollectionsContext";
import SaveToCollection from "./SaveToCollection";
import Sheet from "./Sheet";

/**
 * The app's one "Save to collection" sheet. Rendered once in app/_layout.tsx inside
 * CollectionsProvider; open it from anywhere with useCollectionActions().openSaveSheet(w).
 */
const SaveSheetHost = () => {
  const { wallpaper, close } = useSaveSheetTarget();
  return (
    <Sheet visible={!!wallpaper} onClose={close}>
      {wallpaper ? <SaveToCollection key={wallpaper.id} wallpaper={wallpaper} onDone={close} /> : null}
    </Sheet>
  );
};

export default SaveSheetHost;
