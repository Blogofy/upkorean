// 34 — Oflayn. Opened from the banner on the home screen: what is happening to the learner's answers, and
// what does and does not work without a connection.
import { ScrollView, Text, View } from "react-native";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { BackLink, Button, Feather, Row, Screen, Title } from "../ui";
import { SyncBanner } from "./Today";

export default function Offline({ navigation }) {
  const c = useColors();
  const store = useStore();
  const rows = [
    ["Darslar va takrorlash", true],
    ["So'zlar bazasi va misollar", true],
    ["Talaffuz ovozi va reyting", false],
  ];
  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 8 }}>
        <BackLink label="Bosh sahifa" onPress={() => navigation.goBack()} />
        <Title>Aloqa</Title>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20, gap: 13 }}>
        {store.offline || store.syncError ? <SyncBanner onPress={() => {}} /> : (
          <Row gap={12} style={{ backgroundColor: c.greenTint, borderRadius: 18, padding: 16 }}>
            <Feather name="check-circle" size={20} color={c.greenDeep} />
            <Text style={{ flex: 1, fontFamily: FONTS.bold, fontSize: 14, color: c.greenDeep }}>Hammasi serverga saqlangan</Text>
          </Row>
        )}
        <View style={{ backgroundColor: c.card, borderRadius: 24, padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>Oflaynda nima ishlaydi</Text>
          <View style={{ gap: 11 }}>
            {rows.map(([label, works]) => (
              <Row key={label} gap={12}>
                <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: works ? c.green : c.locked }}>
                  <Feather name={works ? "check" : "x"} size={13} color={works ? c.onGreen : c.ink2} />
                </View>
                <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: works ? c.ink : c.ink2 }}>{label}</Text>
              </Row>
            ))}
          </View>
        </View>
        <Button title="Qayta ulanish" kind="white" onPress={() => store.flush()} />
      </ScrollView>
    </Screen>
  );
}
