import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Dimensions, Modal, Alert } from 'react-native';
import { ArrowLeft, Share, MoreVertical, Copy, Hash, Sparkles, Play, Pause, ChevronLeft, Mic, Search, Globe, FileText, Trash2, X, Send } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Use EXPO_PUBLIC_ variables for client-side env access
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001';

const SummaryScreen = ({ route, navigation }) => {
  const { item } = route.params;
  const [isPlaying, setIsPlaying] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Fallback data
  const summaryData = item.summaryData || {
    topic: item.title,
    summary: item.subtitle,
    keyPoints: []
  };

  const handleRefine = async (instruction) => {
    setMenuVisible(false);
    // Show loading indicator or toast? For simplicity, we'll just update text to "Processing..."
    // In a real app, use a loading state variable not visible in the text itself.
    const originalText = summaryData.summary;
    const originalTopic = summaryData.topic;

    // Optimistic / Loading UI
    summaryData.summary = "✨ AI กำลังเขียนให้ใหม่...";
    // Force re-render if needed, but here we might need state.
    // Better: Update state.
    // Let's assume summaryData is just derived from route params, which is immutable.
    // We should copy it to state to allow editing.
  };

  // State for dynamic content
  // Start with fullText (Raw) if available, otherwise fallback to summary.
  const initialText = item.fullText ? item.fullText : summaryData.summary;
  const [displayedSummary, setDisplayedSummary] = useState(initialText);
  const [isTranslating, setIsTranslating] = useState(false);

  // Reused for both Translate and Action (Clean up)
  const translateText = async (instruction) => {
    setMenuVisible(false);
    setIsTranslating(true);

    // 1. Mock Data Fallback (for Demo)
    // Check if this item has a 'cleanedText' mock available
    if (item.cleanedText && instruction === 'Clean up speech') {
      setTimeout(() => {
        setIsTranslating(false);
        // Switch to the 'Cleaned' version
        setDisplayedSummary(item.cleanedText);
        Alert.alert("Text Cleaned", "The text has been refined for clarity.");
      }, 2000);
      return;
    }

    // 2. Real API Call (for New Recordings)
    try {
      const targetUrl = `${API_URL}/refine`;

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: displayedSummary, // Send current text
          instruction: instruction // 'Clean up speech' or 'Translate this'
        })
      });

      const data = await response.json();
      if (data.result) {
        setDisplayedSummary(data.result);
        Alert.alert("Success", instruction === 'Clean up speech' ? "Text cleaned by AI." : "Translation Complete.");
      } else {
        throw new Error("No result from AI");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Cloud Refine Failed: " + e.message);
    } finally {
      setIsTranslating(false);
    }
  };

  // Process mock analysis delay if image is present
  React.useEffect(() => {
    if (item.imageUri && !item.processed) {
      setIsTranslating(true);
      setTimeout(() => {
        setIsTranslating(false);
        // Ensure "Processing..." text is replaced by actual summary if it was provisional
        // In this architecture, we passed the final result in params directly, so we just toggle loading off.
        Alert.alert("Analysis Complete", "AI has successfully analyzed the image.");
      }, 2500); // 2.5s simulated delay
    }
  }, []);

  const handleSendToFittcore = async () => {
    setMenuVisible(false);
    setIsTranslating(true);

    // MOCK FITTCORE API CALL
    // REAL FITTCORE API CALL
    try {
      const mode = item.mode || 'summary';
      // Default team ID as provided by user
      let teamId = "6937e829ce204df9294c0098";

      const payload = {
        title: item.title || "Note from Mobile App",
        text: displayedSummary, // Send the cleaned/refined text
        team_id: teamId,
        document_id: null // Backend will generate or we can omit
      };

      console.log("Sending to Fittcore:", payload);

      const response = await fetch(`${API_URL}/send-fittcore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // Parse nested response from Fittcore
        // Structure: { status: "success", data: { local_doc_id: "...", data: { ticketCode: "...", ticketId: "..." } } }
        const fittcoreData = data.data?.data || {};
        const ticketIdDisplay = fittcoreData.ticketCode || fittcoreData.ticketId || 'N/A';
        const docIdDisplay = data.data?.local_doc_id || 'N/A';

        let successMsg = `ส่งข้อมูลไปยัง Fittcore เรียบร้อยแล้ว ✅\n\nTicket ID: ${ticketIdDisplay}\nเลขที่เอกสาร: ${docIdDisplay}`;
        if (mode === 'so') {
          successMsg += `\n(Sent to Sales Order Team)`;
        }
        Alert.alert("Success", successMsg);
      } else {
        throw new Error(data.error || "Failed to send to Fittcore");
      }

    } catch (e) {
      console.error("Fittcore Error:", e);
      Alert.alert("Error", "Network Error: " + e.message);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Loading Overlay */}
      {isTranslating && (
        <View style={{ position: 'absolute', top: 100, alignSelf: 'center', zIndex: 999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 20 }}>
          <Text style={{ color: 'white' }}>✨ กำลังดำเนินการ...</Text>
        </View>
      )}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#818CF8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {item.mode === 'so' ? 'Create SO' : 'Summary'}
        </Text>
        <TouchableOpacity onPress={handleSendToFittcore}>
          <Send size={24} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Audio Player Pill - Only show if NO imageUri (meaning it's a voice note) */}
        {!item.imageUri && (
          <View style={styles.audioPlayer}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={16} color="#000" fill="#000" /> : <Play size={16} color="#000" fill="#000" />}
            </TouchableOpacity>
            <Text style={styles.duration}>2:53</Text>
            <Text style={styles.audioDate}>1 ธ.ค. 2568 11:50</Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.mainTitle}>{summaryData.topic}</Text>

        {/* Image if present */}
        {item.imageUri && (
          <Image source={{ uri: item.imageUri }} style={styles.coverImage} resizeMode="cover" />
        )}

        {/* Subtitle / Intro - Removed as requested */}
        {/* {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null} */}

        {/* Body Text (Cleaned) */}
        <Text style={styles.bodyText}>
          {displayedSummary}
        </Text>

        {/* Raw Text (Optional: only if main text is NOT the raw text) */}
        {item.fullText && displayedSummary !== item.fullText && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.headerTitle, { marginBottom: 10 }]}>Raw Transcript:</Text>
            <Text style={[styles.bodyText, { color: '#666' }]}>{item.fullText}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Floating Bar */}
      <View style={styles.bottomContainer}>
        <View style={styles.floatingBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => Alert.alert("Copied", "Text copied to clipboard.")}
          >
            <Copy size={22} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => Alert.alert("Tags", "Tags (#medical, #note) added.")}
          >
            <Hash size={22} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => translateText('Clean up speech')}
          >
            <Sparkles size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>เขียนใหม่</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => Alert.alert("Share", "Sharing options opened.")}
          >
            <Share size={22} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setMenuVisible(true)}
          >
            <MoreVertical size={22} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Context Menu Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContent}>
            <View style={styles.menuHeader}>
              <View />
              <View style={styles.menuIndicator} />
              <View />
            </View>

            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Feature", "Feature available.")}>
              <Mic size={24} color="#334155" />
              <Text style={styles.menuText}>บันทึกเพิ่ม</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => translateText('Translate this')}>
              <Globe size={24} color="#334155" />
              <Text style={styles.menuText}>แปลสิ่งนี้</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => translateText('Clean up speech')}>
              <Sparkles size={24} color="#334155" />
              <Text style={styles.menuText}>การกระทำ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Save Audio", "Audio saved to device.")}>
              <FileText size={24} color="#334155" />
              <Text style={styles.menuText}>บันทึกเสียงไปยัง</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Language", "Language detected: Thai/English")}>
              <Text style={styles.menuIconText}>文</Text>
              <Text style={styles.menuText}>ภาษาของผู้พูด</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleSendToFittcore}>
              <Share size={24} color="#334155" />
              <Text style={styles.menuText}>ส่งไปยัง Fittcore</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert("Delete", "Are you sure you want to delete this note?", [{ text: "Cancel" }, { text: "Delete", style: 'destructive' }])}>
              <Trash2 size={24} color="#EF4444" />
              <Text style={[styles.menuText, { color: '#EF4444' }]}>ลบการจดบันทึกนี้</Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate 50
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155', // Slate 700
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF', // Indigo 50
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignSelf: 'flex-start',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  playButton: {
    marginRight: 12,
  },
  duration: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4F46E5', // Indigo 600
    marginRight: 12,
    fontVariant: ['tabular-nums'],
  },
  audioDate: {
    fontSize: 14,
    color: '#64748B', // Slate 500
    fontWeight: '500',
  },
  mainTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A', // Slate 900
    marginBottom: 16,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  coverImage: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#475569', // Slate 600
    marginBottom: 24,
    lineHeight: 28,
  },
  bodyText: {
    fontSize: 18,
    color: '#334155', // Slate 700
    lineHeight: 32,
    marginBottom: 24,
    textAlign: 'justify',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 34,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 36, // More rounded
    paddingVertical: 12,
    paddingHorizontal: 18,
    width: '100%',
    height: 76,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5', // Indigo 600
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 26,
    height: 52,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Menu Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate overlay
    justifyContent: 'flex-end',
  },
  menuContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  menuHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  menuIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0', // Slate 200
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#334155', // Slate 700
    flex: 1,
  },
  menuIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
    width: 24,
    textAlign: 'center',
  },
  proBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default SummaryScreen;
