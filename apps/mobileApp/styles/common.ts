import { StyleSheet } from "react-native";
import { Colors } from "../constants";

export const commonStyles = StyleSheet.create({
  screenCenter: {
    flex: 1,
    backgroundColor: Colors.bgSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: Colors.bgElevated,
    width: "80%",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  segmentedContainer: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    gap: 10,
    padding: 10,
  },
  segmentedButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSecondary,
  },
  segmentedButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "bold",
  },
  section: {
    gap: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  button: {
    backgroundColor: Colors.bgSecondary,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: "bold",
  },
  input: {
    flex: 1,
    padding: 10,
    color: Colors.textPrimary,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
});
  