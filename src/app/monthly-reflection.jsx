// app/monthly-reflection.jsx — Monats-Reflexion (ab Pro)
import React, { useCallback, useRef, useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import { getSessionHistory, getUserPlan, getDailyStreak } from "@/utils/storage";
import { useI18n } from "@/utils/i18n";
import { useStillMindTheme } from "@/utils/stillmind-theme";

const LOGO = require("../assets/brand/stillmind-logo-transparent.png");
const MODE_ICONS  = { calm:"🌊", focus:"🎯", sleep:"🌙", emotion:"💚", work:"☕", parent:"👨‍👩‍👧" };

function getMonthStats(history, year, month) {
  const list = (Array.isArray(history)?history:[]).filter(e => {
    if (!e || (e.type && e.type !== "start")) return false;
    const d = new Date(Number(e.timestamp||e.date||0));
    return d.getFullYear()===year && d.getMonth()===month;
  });
  const totalSessions = list.length;
  const totalMinutes = list.reduce((s,e)=>s+Math.round(Number(e.durationSec||60)/60),0);
  const modeCounts = {};
  list.forEach(e=>{ const m=e.mode||e.modeId||"calm"; modeCounts[m]=(modeCounts[m]||0)+1; });
  const topModeId = Object.entries(modeCounts).sort((a,b)=>b[1]-a[1])[0] && [0]||"calm";
  const daySet = new Set(list.map(e=>new Date(Number(e.timestamp||e.date||0)).getDate()));
  const weekCounts=[0,0,0,0];
  list.forEach(e=>{ const d=new Date(Number(e.timestamp||e.date||0)).getDate(); weekCounts[Math.min(Math.floor((d-1)/7),3)]++; });
  const bestWeek = weekCounts.indexOf(Math.max(...weekCounts));
  return { totalSessions, totalMinutes, topModeId, activeDays:daySet.size, weekCounts, bestWeek };
}

function insight(s, name, t) {
  if (s.totalSessions===0) return t("monthly_insight_none", {month: name});
  if (s.totalSessions>=20) return t("monthly_insight_exceptional", {month: name, n: s.totalSessions});
  if (s.activeDays>=15) return t("monthly_insight_habit", {n: s.activeDays, month: name});
  if (s.totalSessions>=10) return t("monthly_insight_good", {n: s.totalSessions, month: name});
  return t("monthly_summary", {n: s.totalSessions, s: s.totalSessions>1?"s":"", month: name});
}

export default function MonthlyReflectionScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const MODE_LABELS = { calm:t("cat_calm_label"), focus:t("cat_focus_label"), sleep:t("cat_sleep_label"), emotion:t("cat_emotion_label"), work:t("cat_work_label"), parent:t("cat_parent_label") };
    const MONTH_NAMES = useMemo(() => Array.from({length:12}, (_,i) => new Date(2000,i,1).toLocaleString(lang==="en"?"en":"de",{month:"long"})), [lang]);
  const { colors } = useStillMindTheme();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const [stats, setStats] = useState(null);
  const [streak, setStreak] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold });

  const load = useCallback(async () => {
    const [hist] = await Promise.all([getSessionHistory().catch(()=>[])]);
    const str = await getDailyStreak(hist).catch(()=>0);
    setStreak(str);
    setStats(getMonthStats(hist, year, month));
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim,{toValue:1,duration:420,useNativeDriver:true}).start();
  }, [month, year]);

  useFocusEffect(useCallback(()=>{ load(); },[load]));

  const goMonth = (d) => {
    let m=month+d, y=year;
    if(m<0){m=11;y--;} if(m>11){m=0;y++;}
    if(y>now.getFullYear()||(y===now.getFullYear()&&m>now.getMonth())) return;
    setMonth(m); setYear(y);
  };

  if (!fontsLoaded) return <View style={{flex:1,backgroundColor:colors.background}}/>;

  const isNow = month===now.getMonth()&&year===now.getFullYear();
  const A="#CDB98A", G="rgba(205,185,138,0.10)", B="rgba(205,185,138,0.16)";

  return (
    <View style={{flex:1,backgroundColor:colors.background}}>
      <StatusBar style="light"/>
      <ScrollView contentContainerStyle={{paddingTop:insets.top+16,paddingBottom:insets.bottom+40}} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{paddingHorizontal:24,marginBottom:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
          <Image source={LOGO} resizeMode="contain" style={{ width: 72, height: 72, opacity: 0.97 }}/>
          <TouchableOpacity onPress={()=>router.back()} style={{paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:"rgba(255,255,255,0.06)",borderWidth:1,borderColor:"rgba(255,255,255,0.10)"}}>
            <Text style={{fontFamily:"Montserrat_500Medium",fontSize:13,color:colors.textSecondary}}>{t("back_btn")}</Text>
          </TouchableOpacity>
        </View>

        <View style={{paddingHorizontal:24,marginBottom:24}}>
          <Text style={{fontFamily:"Montserrat_700Bold",fontSize:36,color:colors.text,letterSpacing:-0.5,marginBottom:4}}>{t("monthly_reflection_title")}</Text>
          <Text style={{fontFamily:"Montserrat_400Regular",fontSize:14,color:colors.textSecondary}}>{t("monthly_reflection_sub")}</Text>
        </View>

        {/* Month nav */}
        <View style={{paddingHorizontal:24,marginBottom:20}}>
          <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"rgba(255,255,255,0.05)",borderRadius:16,borderWidth:1,borderColor:"rgba(255,255,255,0.08)",paddingVertical:14,paddingHorizontal:20}}>
            <TouchableOpacity onPress={()=>goMonth(-1)} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <Text style={{fontSize:22,color:A}}>‹</Text>
            </TouchableOpacity>
            <Text style={{fontFamily:"Montserrat_700Bold",fontSize:18,color:colors.text}}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={()=>goMonth(1)} hitSlop={{top:12,bottom:12,left:12,right:12}} style={{opacity:isNow?0.2:1}}>
              <Text style={{fontSize:22,color:A}}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {stats && (
          <Animated.View style={{opacity:fadeAnim}}>

            {/* Insight Card */}
            <View style={{paddingHorizontal:24,marginBottom:16}}>
              <View style={{backgroundColor:G,borderRadius:18,borderWidth:1,borderColor:B,padding:20}}>
                <Text style={{fontSize:22,marginBottom:10}}>✦</Text>
                <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:16,color:colors.text,lineHeight:24}}>{insight(stats,MONTH_NAMES[month],t)}</Text>
              </View>
            </View>

            {/* Stats Grid */}
            <View style={{paddingHorizontal:24,marginBottom:16,flexDirection:"row",gap:10}}>
              {[{label:t("session"),value:stats.totalSessions,icon:"🧘"},{label:t("minutes"),value:stats.totalMinutes,icon:"⏱"},{label:t("monthly_active_days"),value:stats.activeDays,icon:"📅"}].map(item=>(
                <View key={item.label} style={{flex:1,backgroundColor:"rgba(255,255,255,0.05)",borderRadius:16,borderWidth:1,borderColor:"rgba(255,255,255,0.08)",padding:14,alignItems:"center"}}>
                  <Text style={{fontSize:20,marginBottom:6}}>{item.icon}</Text>
                  <Text style={{fontFamily:"Montserrat_700Bold",fontSize:22,color:colors.text}}>{item.value}</Text>
                  <Text style={{fontFamily:"Montserrat_400Regular",fontSize:10,color:colors.textSecondary,marginTop:3,textAlign:"center"}}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Top Mode */}
            {stats.totalSessions>0 && (
              <View style={{paddingHorizontal:24,marginBottom:16}}>
                <View style={{backgroundColor:"rgba(255,255,255,0.05)",borderRadius:18,borderWidth:1,borderColor:"rgba(255,255,255,0.08)",padding:18,flexDirection:"row",alignItems:"center",gap:16}}>
                  <View style={{width:52,height:52,borderRadius:14,backgroundColor:G,alignItems:"center",justifyContent:"center"}}>
                    <Text style={{fontSize:26}}>{MODE_ICONS[stats.topModeId]||"🪷"}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{fontFamily:"Montserrat_400Regular",fontSize:10,color:colors.textSecondary,letterSpacing:1.5,marginBottom:3}}>{t("monthly_fav_mode")}</Text>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:15,color:colors.text}}>{MODE_LABELS[stats.topModeId]||stats.topModeId}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Week Bar Chart */}
            {stats.totalSessions>0 && (
              <View style={{paddingHorizontal:24,marginBottom:16}}>
                <View style={{backgroundColor:"rgba(255,255,255,0.05)",borderRadius:18,borderWidth:1,borderColor:"rgba(255,255,255,0.08)",padding:18}}>
                  <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:13,color:colors.text,marginBottom:14}}>{t("monthly_sessions_per_week")}</Text>
                  <View style={{flexDirection:"row",alignItems:"flex-end",gap:8,height:72}}>
                    {stats.weekCounts.map((count,i)=>{
                      const max=Math.max(...stats.weekCounts,1);
                      const h=Math.max(6,(count/max)*64);
                      const top=i===stats.bestWeek;
                      return (
                        <View key={i} style={{flex:1,alignItems:"center",gap:5}}>
                          <View style={{width:"100%",height:h,borderRadius:6,backgroundColor:top?A:"rgba(255,255,255,0.12)"}}/>
                          <Text style={{fontFamily:"Montserrat_500Medium",fontSize:10,color:top?A:colors.textSecondary}}>W{i+1}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* Streak */}
            <View style={{paddingHorizontal:24,marginBottom:16}}>
              <View style={{backgroundColor:G,borderRadius:18,borderWidth:1,borderColor:B,padding:18,flexDirection:"row",alignItems:"center",gap:16}}>
                <Text style={{fontSize:34}}>{streak>=30?"💎":streak>=7?"🔥":streak>=1?"⚡":"🌱"}</Text>
                <View style={{flex:1}}>
                  <Text style={{fontFamily:"Montserrat_700Bold",fontSize:26,color:colors.text}}>{streak}</Text>
                  <Text style={{fontFamily:"Montserrat_400Regular",fontSize:13,color:A}}>{streak===1?t("day")+" Streak":t("days_word")+" Streak"}</Text>
                </View>
                {streak>=7&&(
                  <View style={{backgroundColor:"rgba(205,185,138,0.12)",borderRadius:10,paddingHorizontal:10,paddingVertical:5,borderWidth:1,borderColor:B}}>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:11,color:A}}>
                      {streak>=100?t("monthly_streak_legend"):streak>=30?t("monthly_streak_strong"):t("monthly_streak_badge")}
                    </Text>
                  </View>
                )}
              </View>
            </View>

          </Animated.View>
        )}

        {/* Empty state */}
        {(stats && stats.totalSessions)===0&&(
          <View style={{paddingHorizontal:24,alignItems:"center",paddingTop:12}}>
            <Text style={{fontSize:44,marginBottom:12}}>🌙</Text>
            <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:17,color:colors.text,textAlign:"center",marginBottom:8}}>{t("monthly_no_sessions")}</Text>
            <Text style={{fontFamily:"Montserrat_400Regular",fontSize:13,color:colors.textSecondary,textAlign:"center",lineHeight:20}}>Starte deine erste Session und kehre zurück um deinen Fortschritt zu sehen.</Text>
            <TouchableOpacity onPress={()=>router.replace("/(tabs)")} style={{marginTop:20,backgroundColor:A,borderRadius:14,paddingVertical:12,paddingHorizontal:24}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:13,color:"#0C0B09"}}>{t("start_session")}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
