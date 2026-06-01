import React from "react";
import { View, Text, Image } from "react-native";

export default function StillMindLogo({ size = 40, showText = true }) {
  const iconSize = Math.round(size * 0.95);

  return (
    <View style={{ alignItems: "flex-start" }}>
      <Image
        source={require("../../assets/brand/stillmind-logo-transparent.png")}
        style={{
          width: iconSize,
          height: iconSize,
          marginBottom: showText ? 6 : 0,
        }}
        resizeMode="contain"
      />

      {showText ? (
        <Text
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: 16,
            letterSpacing: 0.2,
            fontFamily: "Montserrat_600SemiBold",
          }}
        >
          StillMind
        </Text>
      ) : null}
    </View>
  );
}