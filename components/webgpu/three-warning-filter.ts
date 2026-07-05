import { LogBox, Platform } from "react-native";
import * as THREE from "three/webgpu";

const CLOCK_DEPRECATION = "THREE.Clock: This module has been deprecated";

if (Platform.OS !== "web") {
  LogBox.ignoreLogs([CLOCK_DEPRECATION]);
}

const previousConsoleFunction = THREE.getConsoleFunction?.();

THREE.setConsoleFunction?.((type, message, ...params) => {
  if (type === "warn" && String(message).includes(CLOCK_DEPRECATION)) {
    return;
  }

  if (previousConsoleFunction) {
    previousConsoleFunction(type, message, ...params);
    return;
  }

  console[type](message, ...params);
});
