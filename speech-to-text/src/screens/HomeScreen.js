import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Image, Modal, Alert, Dimensions } from 'react-native';
import { Plus, Mic, Search, Settings, ArrowUpDown, Camera, Image as ImageIcon, X, Check, Trash2, Hash, Layers, Cloud, FileText, ChevronRight, ChevronLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import RecordingItem from '../components/RecordingItem';

const { width } = Dimensions.get('window');

const MOCK_DATA = [
  {
    id: '1',
    time: '13:50',
    title: 'สรุปเทรนด์การตลาด 2026',
    subtitle: 'เทรนด์การตลาดที่สำคัญในปี 2026...',
    mode: 'summary',
    fullText: "เอ่อ คือว่า... วันนี้เรามาคุยเรื่องเทรนด์การตลาดของปี 2026 กันนะครับ ก็... หลักๆ เลยที่เห็นชัดๆ คือเรื่องของ Hyper-personalization อะครับ แบบว่า... ลูกค้าไม่ได้อยากได้แค่สินค้าทั่วๆ ไปแล้ว แต่เขาอยากได้อะไรที่มันเป็นของเขาจริงๆ ที่แบบ... เข้าใจบริบทของเขา ณ ตอนนั้นเลย แล้วก็... อีกเรื่องนึงที่สำคัญมากๆ คือเรื่องของ Sustainability อันนี้คือแบบ... ขาดไม่ได้เลยครับ ถ้าแบรนด์ไหนไม่ทำเรื่องนี้นะ ผมว่าอยู่ยาก... เพราะว่าผู้บริโภคยุคใหม่เขาแคร์เรื่องนี้กันจริงๆ แล้วก็... เรื่องสุดท้ายน่าจะเป็นเรื่องของ AI Agent ครับ คือไม่ใช่แค่ AI ธรรมดาแล้ว แต่เป็น Agent ที่ช่วยตัดสินใจแทนได้เลย... ประมาณนี้ครับ",
    subtitle: 'เอ่อ คือว่า... วันนี้เรามาคุยเรื่องเทรนด์การตลาดของปี 2026 กันนะครับ ก็... หลักๆ เลยที่เห็นชัดๆ...',
    cleanedText: "วันนี้เรามาคุยเรื่องเทรนด์การตลาดของปี 2026 ประเด็นหลักที่เห็นได้ชัดคือเรื่อง Hyper-personalization ลูกค้าหมดยุคที่อยากได้สินค้าทั่วไปแล้ว แต่ต้องการสิ่งที่ตอบโจทย์เฉพาะบุคคลและบริบท ณ ขณะนั้นจริงๆ\n\nอีกเรื่องที่สำคัญมากและขาดไม่ได้คือ Sustainability หากแบรนด์ใดไม่ให้ความสำคัญจะแข่งขันได้ยาก เพราะผู้บริโภคยุคใหม่ใส่ใจเรื่องนี้อย่างจริงจัง สุดท้ายคือเรื่อง AI Agent ซึ่งวิวัฒนาการจาก AI ธรรมดามาเป็นตัวช่วยที่สามารถตัดสินใจแทนมนุษย์ได้ครับ",
    summaryData: {
      topic: "สรุปเทรนด์การตลาด 2026",
      summary: "เนื้อหาถูกปรับปรุงให้อ่านง่ายขึ้นแล้ว"
    }
  },
  {
    id: '2',
    time: '11:48',
    title: 'กฎหมายใหม่ปราบภัยไซเบอร์',
    subtitle: 'ก็... มันมีกฎหมายใหม่ออกมานะครับ เกี่ยวกับพวก...',
    count: 1,
    mode: 'summary',
    fullText: "ก็... มันมีกฎหมายใหม่ออกมานะครับ เกี่ยวกับพวก... มิจฉาชีพเนี่ยแหละ คือ... ถ้าใครโดนหลอกโอนเงินนะ ตอนนี้แบงก์เค้าต้องรับผิดชอบร่วมด้วยนะ... แบบว่าระงับบัญชีม้าให้ทันทีเลย ไรงี้ ไม่ไม่ต้องรอแจ้งความนานๆ เหมือนเมื่อก่อน... ดีขึ้นเยอะเลยครับ",
    cleanedText: "มีกฎหมายใหม่เกี่ยวกับมาตรการปราบปรามมิจฉาชีพทางไซเบอร์ออกมาครับ สาระสำคัญคือหากผู้เสียหายถูกหลอกให้โอนเงิน ทางธนาคารจะต้องมีส่วนรับผิดชอบและสามารถระงับบัญชีต้องสงสัย (บัญชีม้า) ได้ทันที โดยไม่ต้องรอขั้นตอนการแจ้งความที่ล่าช้าเหมือนในอดีต ซึ่งถือเป็นการเปลี่ยนแปลงที่ดีขึ้นมากครับ",
    summaryData: { topic: "กฎหมายใหม่ปราบภัยไซเบอร์", summary: "..." }
  },
  {
    id: '3',
    time: '11:40',
    title: 'นิทานลูกหมูสามตัว',
    subtitle: 'Once upon a time... เอ่อ กาลครั้งหนึ่งนานมาแล้ว...',
    mode: 'summary',
    fullText: "Once upon a time... เอ่อ กาลครั้งหนึ่งนานมาแล้ว... มีลูกหมูสามตัว three little pigs... ตัวแรกสร้างบ้านด้วยฟาง straw house... มันไม่ค่อยแข็งแรงนะ not very strong... แล้วหมาป่าก็มาเป่าพู่ววว... พังเลย... แต่ตัวที่สามฉลาดสุด สร้างด้วยอิฐ brick house แข็งแรงมาก",
    cleanedText: "กาลครั้งหนึ่งนานมาแล้ว มีลูกหมูสามตัว ตัวแรกสร้างบ้านด้วยฟางซึ่งไม่ค่อยแข็งแรงนัก เมื่อหมาป่ามาเป่าลมใส่ บ้านก็พังทลายลงทันที แต่ลูกหมูตัวที่สามนั้นฉลาดที่สุด โดยเลือกสร้างบ้านด้วยอิฐซึ่งมีความแข็งแรงทนทานมาก",
    summaryData: { topic: "นิทานลูกหมูสามตัว", summary: "..." }
  },
  {
    id: '4',
    time: '11:32',
    title: 'คุยงานโปรเจกต์งานแต่ง',
    subtitle: 'Speaker 1: ฮัลโหล... ได้ยินไหม? เออ เรื่องดอกไม้...',
    mode: 'summary',
    fullText: "Speaker 1: ฮัลโหล... ได้ยินไหม? เออ เรื่องดอกไม้น่ะ เอาสีขาวนะ\nSpeaker 2: ได้ค่ะ สีขาวล้วนเลยไหมคะ หรือแซมชมพู?\nSpeaker 1: เอาขาวล้วนเลย แบบคลีนๆ มินิมอลหน่อย ไม่อยากได้สีฉูดฉาด\nSpeaker 2: โอเคค่ะ รับทราบ เดี๋ยวจัดแบบให้ดูพรุ่งนี้นะคะ",
    cleanedText: "Speaker 1: แจ้งความต้องการเรื่องดอกไม้สำหรับงาน โดยระบุว่าต้องการธีมสีขาวล้วน สไตล์คลีนและมินิมอล ไม่ต้องการสีฉูดฉาด\nSpeaker 2: รับทราบความต้องการ และแจ้งว่าจะจัดเตรียมแบบตัวอย่างให้ดูภายในวันพรุ่งนี้",
    summaryData: { topic: "คุยงานโปรเจกต์งานแต่ง", summary: "..." }
  },
];

const HomeScreen = ({ navigation }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState('feature'); // 'feature' or 'input'
  const [selectedFeature, setSelectedFeature] = useState('summary'); // 'summary' or 'so'
  const [sourceButton, setSourceButton] = useState('plus'); // 'plus' or 'mic'
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());

  const handleLongPress = (id) => {
    setIsSelectionMode(true);
    toggleSelection(id);
  };

  const handlePress = (item) => {
    if (isSelectionMode) {
      toggleSelection(item.id);
    } else {
      navigation.navigate('Summary', { item });
    }
  };

  const toggleSelection = (id) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const closeSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedItems.has(item.id);
    return (
      <View style={styles.itemContainer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(item)}
          onLongPress={() => handleLongPress(item.id)}
          style={{ flex: 1 }}
        >
          <RecordingItem item={item} />

          {/* Stack Count Indicator */}
          {item.count && !isSelectionMode && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{item.count}</Text>
              <Layers size={12} color="#6B7280" />
            </View>
          )}
        </TouchableOpacity>

        {isSelectionMode && (
          <View style={[styles.selectionCircle, isSelected && styles.selectedCircle]}>
            {isSelected && <Check size={12} color="#fff" />}
          </View>
        )}
      </View>
    );
  };

  const pickImage = async (useCamera = false) => {
    setModalVisible(false);
    // Request permissions logic
    // ...
    let result = await (useCamera
      ? ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      })
      : ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      }));

    if (!result.canceled) {
      setModalVisible(false);
      setModalStep('feature');

      const isSO = selectedFeature === 'so';

      // Mock processing delay effect could be added here or in SummaryScreen
      navigation.navigate('Summary', {
        item: {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          title: isSO ? "Sales Order Data" : "Image Analysis",
          subtitle: "Imported from " + (useCamera ? "Camera" : "Gallery"),
          fullText: "[Image Attached] - The system has processed this image.",
          imageUri: result.assets[0].uri,
          summaryData: {
            topic: isSO ? "Generated Sales Order" : "Visual Summary",
            summary: isSO
              ? "Detected Items:\n1. White Shirt (Qty: 2)\n2. Black Shoes (Size 42)\n3. Receipt #12345"
              : "The image contains text details that have been extracted and summarized here. (Demo Mock)",
            keyPoints: isSO ? ["Order confirmed", "Payment pending"] : ["Visual content detected"]
          },
          mode: selectedFeature
        }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => Alert.alert("Sort Order", "Sort options: Date, Size, Title")}
          >
            <ArrowUpDown size={20} color="#334155" />
          </TouchableOpacity>

          {/* Replaced PRO with Cloud Sync Status */}
          <View style={styles.proBadgeContainer}>
            <TouchableOpacity
              style={styles.proBadge}
              onPress={() => Alert.alert("Cloud Sync", "Your notes are safely backed up to the cloud. ✅")}
            >
              <View style={styles.crownIcon}>
                <Cloud size={18} color="#4F46E5" fill="#E0E7FF" />
              </View>
              <Text style={styles.proText}>Cloud Auto-Sync</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Settings size={20} color="#334155" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity><Text style={[styles.tabText, styles.activeTab]}>ทุก</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Tab", "Unorganized notes")}>
            <Text style={styles.tabText}>ไม่จัดระเบียบ</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Tab", "Archived notes")}>
            <Text style={styles.tabText}>คลังเก็บ</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Edit Order", "Reorder tabs")}>
            <Text style={styles.tabText}>🖊️</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.dateHeader}>7 วันที่ผ่านมา</Text>
      </View>

      {/* Content */}
      <FlatList
        data={MOCK_DATA}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Bar Logic */}
      {isSelectionMode ? (
        <View style={styles.selectionModeContainer}>
          {/* Selection Actions Pill */}
          <View style={styles.selectionBar}>
            <TouchableOpacity style={styles.selectionAction}>
              <Text style={styles.selectionCount}>{selectedItems.size}</Text>
              <Text style={styles.selectionLabel}>เลือกแล้ว</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.selectionAction}>
              <Hash size={24} color="#333" />
              <Text style={styles.selectionLabel}>แท็ก</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.selectionAction}>
              <Trash2 size={24} color="#EF4444" />
              <Text style={[styles.selectionLabel, { color: '#EF4444' }]}>ลบ ({selectedItems.size})</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.floatingCloseButton}
            onPress={closeSelectionMode}
          >
            <X size={24} color="#333" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bottomButtonsWrapper}>
          <TouchableOpacity
            style={styles.roundButton}
            onPress={() => {
              setSourceButton('plus');
              setModalVisible(true);
            }}
          >
            <Plus size={30} color="#000" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.centerPillButton}
            onPress={() => {
              setSourceButton('mic');
              setModalVisible(true);
            }}
          >
            <View style={styles.iconWrapper}>
              <Mic size={36} color="#fff" />
              {/* Custom Smile Shape via View or SVG would be ideal, using simple border radius trick here */}
              <View style={styles.smileCurve} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.roundButton}>
            <Search size={28} color="#000" />
          </TouchableOpacity>
        </View>
      )}

      {/* Modal remains the same */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setModalStep('feature');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setModalVisible(false);
            setModalStep('feature');
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setModalVisible(false);
                setModalStep('feature');
              }}
            >
              <X size={24} color="#333" />
            </TouchableOpacity>

            {/* Step 1: Feature Selection */}
            {modalStep === 'feature' ? (
              <>
                <Text style={styles.modalTitle}>
                  {sourceButton === 'mic' ? 'Record for...' : 'What would you like to do?'}
                </Text>
                <View style={styles.featureOptionsContainer}>
                  <TouchableOpacity
                    style={styles.featureOption}
                    onPress={() => {
                      if (sourceButton === 'mic') {
                        setModalVisible(false);
                        navigation.navigate('Record', { mode: 'summary' });
                      } else {
                        setSelectedFeature('summary');
                        setModalStep('input');
                      }
                    }}
                  >
                    <View style={[styles.featureIcon, { backgroundColor: '#EEF2FF' }]}>
                      <Layers size={32} color="#4F46E5" />
                    </View>
                    <View>
                      <Text style={styles.featureTitle}>Summary</Text>
                      <Text style={styles.featureSubtitle}>Meeting notes & analysis</Text>
                    </View>
                    <ChevronRight size={20} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.featureOption}
                    onPress={() => {
                      if (sourceButton === 'mic') {
                        setModalVisible(false);
                        navigation.navigate('Record', { mode: 'so' });
                      } else {
                        setSelectedFeature('so');
                        setModalStep('input');
                      }
                    }}
                  >
                    <View style={[styles.featureIcon, { backgroundColor: '#F0FDF4' }]}>
                      <FileText size={32} color="#16A34A" />
                    </View>
                    <View>
                      <Text style={styles.featureTitle}>Create SO</Text>
                      <Text style={styles.featureSubtitle}>Sales Order generation</Text>
                    </View>
                    <ChevronRight size={20} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Step 2: Input Method Selection */
              <>
                <View style={styles.modalHeaderRow}>
                  <TouchableOpacity onPress={() => setModalStep('feature')} style={{ padding: 4 }}>
                    <ChevronLeft size={24} color="#64748B" />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { marginBottom: 0, flex: 1, textAlign: 'center', marginRight: 28 }]}>
                    {selectedFeature === 'so' ? 'Create SO' : 'New Summary'}
                  </Text>
                </View>

                <Text style={styles.modalSubtitle}>How do you want to provide input?</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.actionButton} onPress={() => pickImage(true)}>
                    <View style={[styles.actionIcon, { backgroundColor: '#E0E7FF' }]}>
                      <Camera size={28} color="#4F46E5" />
                    </View>
                    <Text style={styles.actionText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton} onPress={() => pickImage(false)}>
                    <View style={[styles.actionIcon, { backgroundColor: '#FCE7F3' }]}>
                      <ImageIcon size={28} color="#DB2777" />
                    </View>
                    <Text style={styles.actionText}>Upload Image</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton} onPress={() => {
                    setModalVisible(false);
                    setModalStep('feature');
                    navigation.navigate('Record', { mode: selectedFeature });
                  }}>
                    <View style={[styles.actionIcon, { backgroundColor: '#DCFCE7' }]}>
                      <Mic size={28} color="#16A34A" />
                    </View>
                    <Text style={styles.actionText}>Voice Note</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconButton: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabs: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 24,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    color: '#94A3B8', // Slate 400
    fontWeight: '600',
  },
  activeTab: {
    color: '#334155', // Slate 700
    fontWeight: '800',
    borderBottomWidth: 3,
    borderBottomColor: '#4F46E5', // Indigo 600
    paddingBottom: 6,
  },
  dateHeader: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A', // Slate 900
    marginBottom: 24,
    letterSpacing: -1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 160,
  },
  row: {
    justifyContent: 'space-between',
  },
  itemContainer: {
    width: '48%',
    position: 'relative',
  },
  selectionCircle: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedCircle: {
    backgroundColor: '#4F46E5', // Indigo 600
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  proBadgeContainer: {
    flex: 1, // Take up available space to center
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF', // Indigo 50
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
    minWidth: 120, // Ensure minimum width
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  crownIcon: {
    marginBottom: 2,
  },
  proText: {
    color: '#4F46E5', // Indigo 600
    fontWeight: '700',
    fontSize: 14,
  },

  // Revised Bottom Buttons
  bottomButtonsWrapper: {
    position: 'absolute',
    bottom: 34,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    // Very subtle shadow
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  centerPillButton: {
    width: 140, // Wider pill
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0F172A', // Slate 900
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%', // Ensure centering
    paddingTop: 4,
  },
  smileCurve: {
    width: 26,
    height: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomWidth: 3, // Thicker smile
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: '#fff',
    borderTopWidth: 0,
    marginTop: 2,
    opacity: 0.9,
  },

  // Selection Mode Bottom Logic
  selectionModeContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectionBar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 35,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectionAction: {
    alignItems: 'center',
    gap: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  selectionCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  selectionLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  floatingCloseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate overlay
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 32,
    color: '#0F172A',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionButton: {
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  actionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },

  // New Modal Styles
  featureOptionsContainer: {
    gap: 16,
    marginBottom: 16,
  },
  featureOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
});

export default HomeScreen;
