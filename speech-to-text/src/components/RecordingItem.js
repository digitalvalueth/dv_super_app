import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Layers } from 'lucide-react-native';

const RecordingItem = ({ item, onPress }) => {
  return (
    <View style={styles.cardWrapper}>
      {/* Card Content */}
      <View style={styles.cardContent}>
        <View style={styles.header}>
          <Text style={styles.time}>{item.time}</Text>
          {/* Stack Count Indicator inside header */}
          {item.count && (
            <View style={styles.stackBadge}>
              <Text style={styles.stackText}>{item.count}</Text>
              <Layers size={14} color="#6B7280" />
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={3}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={4}>{item.subtitle}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    // Very subtle shadow as per screenshot
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    height: 200, // Fixed height for grid alignment looks
    justifyContent: 'space-between'
  },
  cardContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  time: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  stackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stackText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
});

export default RecordingItem;
