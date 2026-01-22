import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Animated, SafeAreaView } from 'react-native';
// import Voice from '@react-native-voice/voice'; // Commented out for Expo Go demo
import { Mic, Square, ArrowLeft, RotateCcw, Pause, Play, Users, ChevronLeft, ToggleLeft, ToggleRight, Rewind } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { cleanText, generateSummary } from '../services/api';

// Use EXPO_PUBLIC_ variables for client-side env access
// Hardware IP detected from logs: 172.20.10.2 (Hotspot)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.2:5001';
// const API_URL = 'http://172.168.1.121:5001/stt-clean'; // OLD

const RecordScreen = ({ navigation, route }) => {
  // ... (existing state)

  // ... (existing code)


  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState('');
  const [partialText, setPartialText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMultiSpeaker, setIsMultiSpeaker] = useState(false);

  const timerRef = useRef(null);

  // Animation values for waveform
  const bar1 = useRef(new Animated.Value(40)).current;
  const bar2 = useRef(new Animated.Value(60)).current;
  const bar3 = useRef(new Animated.Value(80)).current;
  const bar4 = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Cleanup if needed
    return () => { };
  }, []);

  useEffect(() => {
    // Define variable inside effect scope if needed, or outside if used for cleanup
    // let animLoop; // This variable is not currently used in the effect.

    if (isRecording) {
      const animateBar = (bar, min, max, duration) => {
        return Animated.sequence([
          Animated.timing(bar, { toValue: max, duration: duration, useNativeDriver: false }),
          Animated.timing(bar, { toValue: min, duration: duration, useNativeDriver: false })
        ]);
      };

      const loopAnimation = () => {
        Animated.loop(
          Animated.parallel([
            animateBar(bar1, 40, 90, 400),
            animateBar(bar2, 50, 110, 500),
            animateBar(bar3, 60, 140, 600),
            animateBar(bar4, 40, 80, 450),
          ])
        ).start();
      };
      loopAnimation();
    } else {
      // Reset logic
      bar1.setValue(40);
      bar2.setValue(60);
      bar3.setValue(80);
      bar4.setValue(50);
    }
  }, [isRecording]);

  // Check Backend Connection on Mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      // API_URL is now base, so just fetch it directly (health check is at /)
      const response = await fetch(API_URL, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log("Backend Connected ✅");
      } else {
        Alert.alert("Connection Warning", "Backend reachable but returned error.");
      }
    } catch (err) {
      console.log("Backend Check Failed", err);
      Alert.alert(
        "Cannot Connect to Backend",
        `Ensure your phone and Mac are on the same WiFi.\n\nCurrent Config: ${API_URL}\n\nError: ${err.message}`
      );
    }
  };


  const startRecording = async () => {
    setText('');
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission missing', 'Please allow microphone access to record audio.');
        return;
      }
      // Setup Audio Mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);

      // Timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (err) {
      Alert.alert('Failed to start recording', err.message);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      clearInterval(timerRef.current);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      setRecording(null);
      setDuration(0);

      // Upload
      await handleUpload(uri);

    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (uri) => {
    if (!uri) return;
    setIsProcessing(true);

    try {
      // Using expo-file-system for upload can be tricky with multipart, 
      // but standard fetch with FormData is often easier in newer RN
      const formData = new FormData();

      let filename = uri.split('/').pop();
      let match = /\.(\w+)$/.exec(filename);
      let type = match ? `audio/${match[1]}` : `audio/m4a`;

      formData.append('audio', { uri: uri, name: filename, type });

      // Append /stt-clean to the base URL
      const uploadUrl = API_URL.endsWith('/') ? `${API_URL}stt-clean` : `${API_URL}/stt-clean`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'content-type': 'multipart/form-data',
        },
      });

      const result = await response.json();

      if (result.error) {
        Alert.alert("Backend Error", result.error);
      } else {
        // Navigate to Summary Screen
        navigation.replace('Summary', {
          item: {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            title: "New Recording",
            subtitle: "Just now",
            fullText: result.rawText || "No text transcribed.",
            summaryData: {
              topic: "Processing...",
              summary: result.rawText, // Show raw text initially
              keyPoints: []
            },
            mode: route.params?.mode || 'summary' // Pass the mode along dynamically
          }
        });
      }

    } catch (e) {
      Alert.alert("Upload Failed", "Could not connect to backend. Is it running? \n" + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        {/* Timer Pill */}
        <View style={styles.timerPill}>
          <View style={styles.redDot} />
          <Text style={styles.timerText}>{isProcessing ? "Processing..." : formatTime(duration)}</Text>
        </View>

        {/* Waveform Visualization */}
        <View style={styles.waveformContainer}>
          <Animated.View style={[styles.bar, { height: bar1 }]} />
          <Animated.View style={[styles.bar, { height: bar2 }]} />
          <Animated.View style={[styles.bar, { height: bar3 }]} />
          <Animated.View style={[styles.bar, { height: bar4 }]} />
          {/* Mirror for symmetry */}
          <Animated.View style={[styles.bar, { height: bar4 }]} />
          <Animated.View style={[styles.bar, { height: bar3 }]} />
          <Animated.View style={[styles.bar, { height: bar2 }]} />
          <Animated.View style={[styles.bar, { height: bar1 }]} />
        </View>

        {/* Multi-speaker toggle (Visual Only for now) */}
        <TouchableOpacity
          style={styles.multiSpeakerBadge}
          activeOpacity={0.7}
          onPress={() => setIsMultiSpeaker(!isMultiSpeaker)}
        >
          <View style={[styles.switch, { backgroundColor: isMultiSpeaker ? '#34D399' : '#CBD5E1' }]}>
            <View style={[
              styles.switchKnob,
              !isMultiSpeaker && { alignSelf: 'flex-start' }
            ]} />
          </View>
          <Text style={styles.speakerText}>หลายคนพูด</Text>
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          {/* Rewind */}
          <TouchableOpacity
            style={styles.controlIconBtn}
            onPress={() => Alert.alert("Coming Soon", "Rewind feature is currently in development.")}
          >
            <Rewind size={24} color="#64748B" fill="#64748B" />
          </TouchableOpacity>

          {/* Main Record/Stop Button */}
          <TouchableOpacity
            style={[styles.mainButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isRecording ? (
              <View style={styles.stopSquare} /> // Red Square
            ) : (
              <View style={styles.recordCircle} /> // Red Circle
            )}
          </TouchableOpacity>

          {/* Pause */}
          <TouchableOpacity
            style={styles.controlIconBtn}
            onPress={() => Alert.alert("Coming Soon", "Pause feature is currently in development.")}
          >
            <Pause size={24} color="#64748B" fill="#64748B" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate 50 (Premium White/Grey)
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  dateText: {
    fontSize: 16,
    color: '#64748B', // Slate 500
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B', // Slate 800
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    marginBottom: 60,
    shadowColor: '#4F46E5', // Indigo Glow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 12,
  },
  timerText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: 1,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 150,
    gap: 8,
    marginBottom: 60,
  },
  bar: {
    width: 14,
    backgroundColor: '#4F46E5', // Indigo 600
    borderRadius: 8,
    opacity: 0.8,
  },
  multiSpeakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 10,
    paddingRight: 18,
    borderRadius: 24,
    gap: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switch: {
    width: 36,
    height: 20,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  speakerText: {
    fontSize: 15,
    color: '#475569', // Slate 600
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 50,
    paddingHorizontal: 40,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9', // Slate 100
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 5,
    borderColor: '#E2E8F0', // Slate 200
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  recordingButton: {
    borderColor: '#FEE2E2', // Red 100 ring
  },
  recordCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444', // Red 500
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stopSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
});

export default RecordScreen;
