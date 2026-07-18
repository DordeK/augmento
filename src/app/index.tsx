import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DEMO_PRODUCTS,
} from '@/data/demo-content';
import { AUGMENTO_API_URL, augmentVideo } from '@/lib/augment-api';

type WizardStep = 0 | 1 | 2 | 3;

const STEP_LABELS = ['Upload', 'Match', 'Phrase', 'Preview'];

function formatDuration(duration?: number | null) {
  if (!duration) return 'Duration unavailable';
  const totalSeconds = Math.round(Platform.OS === 'web' ? duration : duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimestamp(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return '--:--';
  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainder = roundedSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function VideoPreview({ uri, compact = false }: { uri: string; compact?: boolean }) {
  const player = useVideoPlayer(uri);

  return (
    <VideoView
      contentFit="cover"
      nativeControls
      player={player}
      style={[styles.video, compact && styles.videoCompact]}
    />
  );
}

function ProgressHeader({ step, onBack }: { step: WizardStep; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        {step > 0 ? (
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons color="#111111" name="arrow-back" size={20} />
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Text style={styles.brand}>Augmento</Text>
        <Text style={styles.stepCount}>{step + 1}/4</Text>
      </View>

      <View style={styles.progressTrack}>
        {STEP_LABELS.map((label, index) => (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.progressBar, index <= step && styles.progressBarActive]} />
            <Text style={[styles.progressLabel, index === step && styles.progressLabelActive]}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PrimaryButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Ionicons color="#FFFFFF" name={icon} size={19} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const [step, setStep] = useState<WizardStep>(0);
  const [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedProductId, setSelectedProductId] = useState(DEMO_PRODUCTS[0].id);
  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [augmentedVideoUri, setAugmentedVideoUri] = useState<string | null>(null);
  const [insertionSeconds, setInsertionSeconds] = useState<number | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isTransitioning = useRef(false);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateX = useRef(new Animated.Value(0)).current;

  const selectedProduct = useMemo(
    () => DEMO_PRODUCTS.find((product) => product.id === selectedProductId) ?? DEMO_PRODUCTS[0],
    [selectedProductId]
  );
  const insertionPercentage = useMemo(() => {
    const durationSeconds = video?.duration
      ? Platform.OS === 'web'
        ? video.duration
        : video.duration / 1000
      : 0;
    if (!durationSeconds || insertionSeconds === null) return 0;
    return Math.min(Math.max((insertionSeconds / durationSeconds) * 100, 0), 100);
  }, [insertionSeconds, video?.duration]);

  const restoreContentPosition = () => {
    Animated.parallel([
      Animated.spring(contentTranslateX, {
        toValue: 0,
        speed: 24,
        bounciness: 0,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const transitionTo = (
    nextStep: WizardStep,
    direction: 'forward' | 'backward',
    onSwitch?: () => void
  ) => {
    if (isTransitioning.current || nextStep === step) {
      restoreContentPosition();
      return false;
    }

    isTransitioning.current = true;
    const exitPosition = direction === 'forward' ? -34 : 34;
    const entryPosition = direction === 'forward' ? 34 : -34;

    Animated.parallel([
      Animated.timing(contentTranslateX, {
        toValue: exitPosition,
        duration: 130,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        isTransitioning.current = false;
        restoreContentPosition();
        return;
      }

      onSwitch?.();
      setStep(nextStep);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      contentTranslateX.setValue(entryPosition);

      Animated.parallel([
        Animated.timing(contentTranslateX, {
          toValue: 0,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        isTransitioning.current = false;
      });
    });

    return true;
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['videos'],
        quality: 1,
      });

      if (!result.canceled) {
        setVideo(result.assets[0]);
        setAugmentedVideoUri(null);
        setInsertionSeconds(null);
        setIsComplete(false);
      }
    } catch {
      Alert.alert('Could not open your library', 'Please try choosing the video again.');
    }
  };

  const findMatches = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      transitionTo(1, 'forward');
    }, 1100);
  };

  const createPreview = async () => {
    if (!video) return;

    setIsProcessing(true);
    try {
      const result = await augmentVideo(video.uri, video.fileName);
      setAugmentedVideoUri(result.uri);
      setInsertionSeconds(result.insertionSeconds);
      setIsComplete(false);
      transitionTo(3, 'forward');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The video could not be augmented.';
      Alert.alert('Could not create the video', message);
    } finally {
      setIsProcessing(false);
    }
  };

  const shareResult = async () => {
    if (!augmentedVideoUri) return;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      await Sharing.shareAsync(augmentedVideoUri, {
        dialogTitle: 'Share augmented video',
        mimeType: 'video/mp4',
        UTI: 'public.mpeg-4',
      });
    } catch (error) {
      Alert.alert(
        'Could not share the video',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const saveResult = async () => {
    if (!augmentedVideoUri) return;
    try {
      if (Platform.OS === 'web') {
        const download = document.createElement('a');
        download.href = augmentedVideoUri;
        download.download = 'augmento-video.mp4';
        download.click();
        setIsComplete(true);
        return;
      }
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['video']);
      if (!permission.granted) {
        throw new Error('Allow photo library access to save the augmented video.');
      }
      await MediaLibrary.saveToLibraryAsync(augmentedVideoUri);
      setIsComplete(true);
      Alert.alert('Video saved', 'The augmented MP4 is now in your photo library.');
    } catch (error) {
      Alert.alert(
        'Could not save the video',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  const goBack = () => {
    if (step > 0) return transitionTo((step - 1) as WizardStep, 'backward');
    restoreContentPosition();
    return false;
  };

  const goForward = () => {
    if (isAnalyzing || isProcessing) return;

    if (step === 0) {
      if (!video) {
        restoreContentPosition();
        Alert.alert('Choose a video first', 'Upload a video before moving to product matches.');
        return false;
      }
      restoreContentPosition();
      findMatches();
      return true;
    }

    if (step === 1) {
      return transitionTo(2, 'forward');
    }

    if (step === 2) {
      restoreContentPosition();
      createPreview();
      return true;
    }

    restoreContentPosition();
    return false;
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    if (isTransitioning.current) return;
    const { pageX, pageY } = event.nativeEvent;
    swipeStart.current = { x: pageX, y: pageY };
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    if (!swipeStart.current || isTransitioning.current) return;

    const { pageX, pageY } = event.nativeEvent;
    const horizontalDistance = pageX - swipeStart.current.x;
    const verticalDistance = pageY - swipeStart.current.y;
    const isHorizontalDrag =
      Math.abs(horizontalDistance) > 10 &&
      Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.4;

    if (!isHorizontalDrag) return;
    const dragPosition = Math.max(-26, Math.min(26, horizontalDistance * 0.18));
    contentTranslateX.setValue(dragPosition);
    contentOpacity.setValue(1 - Math.min(Math.abs(horizontalDistance) / 900, 0.08));
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (!swipeStart.current) return;

    const { pageX, pageY } = event.nativeEvent;
    const horizontalDistance = pageX - swipeStart.current.x;
    const verticalDistance = pageY - swipeStart.current.y;
    swipeStart.current = null;

    const isHorizontalSwipe =
      Math.abs(horizontalDistance) >= 70 &&
      Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.4;

    if (!isHorizontalSwipe) {
      restoreContentPosition();
      return;
    }
    if (horizontalDistance > 0) goBack();
    else goForward();
  };

  const reset = () => {
    transitionTo(0, 'backward', () => {
      if (augmentedVideoUri) {
        if (Platform.OS === 'web') {
          URL.revokeObjectURL(augmentedVideoUri);
        } else {
          const cachedResult = new File(augmentedVideoUri);
          if (cachedResult.exists) cachedResult.delete();
        }
      }
      setVideo(null);
      setAugmentedVideoUri(null);
      setInsertionSeconds(null);
      setSelectedProductId(DEMO_PRODUCTS[0].id);
      setSelectedPhraseIndex(0);
      setIsComplete(false);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ProgressHeader onBack={goBack} step={step} />

      <Animated.View
        style={[
          styles.animatedContent,
          { opacity: contentOpacity, transform: [{ translateX: contentTranslateX }] },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onTouchCancel={() => {
            swipeStart.current = null;
            restoreContentPosition();
          }}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          showsVerticalScrollIndicator={false}
        >
        {step === 0 && (
          <View style={styles.screen}>
            <View>
              <Text style={styles.kicker}>CREATE A SPONSORSHIP</Text>
              <Text style={styles.title}>Start with a vertical video.</Text>
              <Text style={styles.subtitle}>
                Upload a TikTok, Reel, or Short and we’ll find products that feel native to it.
              </Text>
            </View>

            {video ? (
              <View style={styles.selectedVideoCard}>
                <VideoPreview compact uri={video.uri} />
                <View style={styles.fileInfo}>
                  <View style={styles.fileIcon}>
                    <Ionicons color="#10A37F" name="videocam-outline" size={20} />
                  </View>
                  <View style={styles.fileText}>
                    <Text numberOfLines={1} style={styles.fileName}>
                      {video.fileName ?? 'Selected video'}
                    </Text>
                    <Text style={styles.metaText}>{formatDuration(video.duration)}</Text>
                  </View>
                  <Pressable accessibilityLabel="Choose a different video" onPress={pickVideo}>
                    <Ionicons color="#6F6F6B" name="swap-horizontal" size={21} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={pickVideo}
                style={({ pressed }) => [styles.uploadCard, pressed && styles.uploadCardPressed]}
              >
                <View style={styles.uploadIcon}>
                  <Ionicons color="#111111" name="arrow-up-circle-outline" size={34} />
                </View>
                <Text style={styles.uploadTitle}>Choose a video</Text>
                <Text style={styles.uploadHint}>9:16 format works best</Text>
                <View style={styles.uploadPill}>
                  <Text style={styles.uploadPillText}>Browse videos</Text>
                </View>
              </Pressable>
            )}

            {video && <PrimaryButton icon="sparkles" label="Find matching products" onPress={findMatches} />}
          </View>
        )}

        {step === 1 && (
          <View style={styles.screen}>
            <View>
              <Text style={styles.kicker}>TOP MATCHES</Text>
              <Text style={styles.title}>Made for your content.</Text>
              <Text style={styles.subtitle}>Choose one product to feature in your video.</Text>
            </View>

            <View style={styles.cardList}>
              {DEMO_PRODUCTS.map((product, index) => {
                const selected = product.id === selectedProductId;
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => {
                      setSelectedProductId(product.id);
                      setSelectedPhraseIndex(0);
                    }}
                    style={({ pressed }) => [
                      styles.productCard,
                      selected && styles.selectableCardActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.productTopRow}>
                      <View style={[styles.productLogo, { backgroundColor: `${product.accent}20` }]}>
                        <Text style={[styles.productSymbol, { color: product.accent }]}>{product.symbol}</Text>
                      </View>
                      <View style={styles.productIdentity}>
                        <View style={styles.nameRow}>
                          <Text style={styles.productName}>{product.name}</Text>
                          {index === 0 && (
                            <View style={styles.bestBadge}>
                              <Ionicons color="#0B5D4A" name="sparkles" size={10} />
                              <Text style={styles.bestBadgeText}>BEST MATCH</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.productCategory}>{product.category}</Text>
                      </View>
                      <View style={styles.matchScore}>
                        <Text style={styles.matchNumber}>{product.match}%</Text>
                        <Text style={styles.matchLabel}>MATCH</Text>
                      </View>
                    </View>
                    <Text style={styles.productDescription}>{product.description}</Text>
                    <View style={styles.reasonRow}>
                      <Ionicons color={product.accent} name="checkmark-circle" size={17} />
                      <Text style={styles.reasonText}>{product.matchReason}</Text>
                    </View>
                    {selected && (
                      <View style={styles.selectedCheck}>
                        <Ionicons color="#FFFFFF" name="checkmark" size={14} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <PrimaryButton
              icon="arrow-forward"
              label="Generate ad phrases"
              onPress={() => transitionTo(2, 'forward')}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.screen}>
            <View>
              <Text style={styles.kicker}>{selectedProduct.name.toUpperCase()}</Text>
              <Text style={styles.title}>Choose your delivery.</Text>
              <Text style={styles.subtitle}>Pick the phrase that sounds most like you.</Text>
            </View>

            <View style={styles.insertionCard}>
              <View style={styles.pauseIcon}>
                <Ionicons color="#10A37F" name="pulse" size={21} />
              </View>
              <View style={styles.insertionText}>
                <Text style={styles.insertionLabel}>AUTOMATIC INSERTION</Text>
                <Text style={styles.insertionTitle}>Quietest moment</Text>
                <Text style={styles.metaText}>Measured while creating the video</Text>
              </View>
              <View style={styles.timelineMini}>
                <View style={styles.timelineLine} />
                <View style={styles.timelineMarker} />
              </View>
            </View>

            <View style={styles.cardList}>
              {selectedProduct.phrases.map((phrase, index) => {
                const selected = selectedPhraseIndex === index;
                return (
                  <Pressable
                    key={phrase}
                    onPress={() => setSelectedPhraseIndex(index)}
                    style={({ pressed }) => [
                      styles.phraseCard,
                      selected && styles.selectableCardActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.radio, selected && styles.radioActive]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <View style={styles.phraseContent}>
                      <Text style={styles.phraseNumber}>OPTION {index + 1}</Text>
                      <Text style={styles.phraseText}>“{phrase}”</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <PrimaryButton icon="color-wand" label="Create augmented video" onPress={createPreview} />
          </View>
        )}

        {step === 3 && video && augmentedVideoUri && (
          <View style={styles.screen}>
            <View>
              <Text style={styles.kicker}>YOUR RESULT</Text>
              <Text style={styles.title}>Ready to share.</Text>
              <Text style={styles.subtitle}>Preview your sponsorship placement below.</Text>
            </View>

            <View style={styles.resultVideoCard}>
              <VideoPreview uri={augmentedVideoUri} />
              <View style={styles.placementStrip}>
                <View style={styles.placementLine}>
                  <View
                    style={[styles.placementProgress, { width: `${insertionPercentage}%` }]}
                  />
                  <View style={[styles.placementDot, { left: `${insertionPercentage}%` }]} />
                </View>
                <View style={styles.placementLabels}>
                  <Text style={styles.metaText}>0:00</Text>
                  <View style={styles.adMarkerLabel}>
                    <Ionicons color="#10A37F" name="sparkles" size={12} />
                    <Text style={styles.adMarkerText}>
                      AD · {formatTimestamp(insertionSeconds)}
                    </Text>
                  </View>
                  <Text style={styles.metaText}>{formatDuration(video.duration)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={[styles.productLogo, { backgroundColor: `${selectedProduct.accent}20` }]}>
                <Text style={[styles.productSymbol, { color: selectedProduct.accent }]}>
                  {selectedProduct.symbol}
                </Text>
              </View>
              <View style={styles.summaryContent}>
                <Text style={styles.summaryProduct}>{selectedProduct.name}</Text>
                <Text style={styles.summaryPhrase}>
                  “{selectedProduct.phrases[selectedPhraseIndex]}”
                </Text>
              </View>
            </View>

            {isComplete ? (
              <View style={styles.completionCard}>
                <View style={styles.completionIcon}>
                  <Ionicons color="#FFFFFF" name="checkmark" size={22} />
                </View>
                <View style={styles.completionText}>
                  <Text style={styles.completionTitle}>Saved to your library</Text>
                  <Text style={styles.metaText}>The augmented MP4 is ready to publish.</Text>
                </View>
              </View>
            ) : (
              <PrimaryButton icon="download-outline" label="Save to photos" onPress={saveResult} />
            )}

            <Pressable
              onPress={shareResult}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Ionicons color="#111111" name="share-social-outline" size={18} />
              <Text style={styles.secondaryButtonStrongText}>Share video</Text>
            </Pressable>

            <Pressable onPress={reset} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Ionicons color="#6F6F6B" name="refresh" size={18} />
              <Text style={styles.secondaryButtonText}>Start another</Text>
            </Pressable>
          </View>
        )}
        </ScrollView>
      </Animated.View>

      {(isAnalyzing || isProcessing) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingOrb}>
              <ActivityIndicator color="#10A37F" size="large" />
            </View>
            <Text style={styles.loadingTitle}>
              {isAnalyzing ? 'Finding your best matches…' : 'Blending your sponsorship…'}
            </Text>
            <Text style={styles.loadingSubtitle}>
              {isAnalyzing
                ? 'Reading the tone and topic of your video'
                : `Finding the quietest moment via ${AUGMENTO_API_URL}`}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F7F5' },
  animatedContent: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E2DF',
    backgroundColor: '#F7F7F5',
  },
  brandRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E2DF',
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
  },
  backPlaceholder: { width: 36 },
  brand: { color: '#111111', fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  stepCount: { width: 36, color: '#8A8A85', fontSize: 12, fontWeight: '500', textAlign: 'right' },
  progressTrack: { flexDirection: 'row', gap: 5, marginTop: 10 },
  progressItem: { flex: 1, gap: 6 },
  progressBar: { height: 2, borderRadius: 1, backgroundColor: '#DEDEDA' },
  progressBarActive: { backgroundColor: '#10A37F' },
  progressLabel: { color: '#9A9A95', fontSize: 9, fontWeight: '500', textAlign: 'center' },
  progressLabelActive: { color: '#111111' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  screen: { flex: 1, gap: 22 },
  kicker: { marginBottom: 8, color: '#6F6F6B', fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  title: { color: '#111111', fontSize: 30, fontWeight: '600', lineHeight: 36, letterSpacing: -0.8 },
  subtitle: { marginTop: 9, maxWidth: 350, color: '#6F6F6B', fontSize: 15, lineHeight: 22 },
  uploadCard: {
    minHeight: 250,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  uploadCardPressed: { borderColor: '#A9A9A4', backgroundColor: '#FAFAF8' },
  uploadIcon: { alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { marginTop: 16, color: '#111111', fontSize: 17, fontWeight: '600' },
  uploadHint: { marginTop: 6, color: '#8A8A85', fontSize: 13 },
  uploadPill: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#D4D4D0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  uploadPillText: { color: '#111111', fontSize: 13, fontWeight: '500' },
  selectedVideoCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  video: {
    width: '74%',
    maxWidth: 270,
    aspectRatio: 9 / 16,
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  videoCompact: { width: '64%', maxWidth: 235 },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  fileIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EEF7F4',
  },
  fileText: { flex: 1 },
  fileName: { color: '#111111', fontSize: 14, fontWeight: '600' },
  metaText: { marginTop: 3, color: '#8A8A85', fontSize: 12, lineHeight: 17 },
  primaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  primaryButtonPressed: { opacity: 0.78 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  cardList: { gap: 10 },
  productCard: {
    position: 'relative',
    padding: 16,
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  selectableCardActive: { borderColor: '#10A37F', backgroundColor: '#F6FBF9' },
  productTopRow: { flexDirection: 'row', alignItems: 'center' },
  productLogo: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  productSymbol: { fontSize: 19, fontWeight: '700' },
  productIdentity: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  productName: { color: '#111111', fontSize: 15, fontWeight: '600' },
  productCategory: { marginTop: 3, color: '#8A8A85', fontSize: 12 },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#DDF4EC',
  },
  bestBadgeText: { color: '#0B5D4A', fontSize: 8, fontWeight: '600' },
  matchScore: { alignItems: 'flex-end', marginLeft: 8 },
  matchNumber: { color: '#111111', fontSize: 16, fontWeight: '600' },
  matchLabel: { marginTop: 1, color: '#9A9A95', fontSize: 8, fontWeight: '600', letterSpacing: 0.5 },
  productDescription: { marginTop: 13, color: '#4F4F4B', fontSize: 13, lineHeight: 19 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 11,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E2',
  },
  reasonText: { flex: 1, color: '#6F6F6B', fontSize: 12, lineHeight: 17 },
  selectedCheck: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#10A37F',
  },
  insertionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  pauseIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#EEF7F4',
  },
  insertionText: { flex: 1 },
  insertionLabel: { color: '#8A8A85', fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  insertionTitle: { marginTop: 3, color: '#111111', fontSize: 20, fontWeight: '600' },
  timelineMini: { width: 70, height: 24, justifyContent: 'center' },
  timelineLine: { height: 2, borderRadius: 1, backgroundColor: '#D4D4D0' },
  timelineMarker: { position: 'absolute', left: 24, width: 3, height: 16, borderRadius: 2, backgroundColor: '#10A37F' },
  phraseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: '#A9A9A4',
    borderRadius: 10,
  },
  radioActive: { borderColor: '#10A37F' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10A37F' },
  phraseContent: { flex: 1 },
  phraseNumber: { marginBottom: 7, color: '#8A8A85', fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  phraseText: { color: '#2F2F2C', fontSize: 14, lineHeight: 21, fontWeight: '400' },
  resultVideoCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  placementStrip: { paddingHorizontal: 15, paddingTop: 14, paddingBottom: 12 },
  placementLine: { position: 'relative', height: 3, borderRadius: 2, backgroundColor: '#DEDEDA' },
  placementProgress: { height: 3, borderRadius: 2, backgroundColor: '#10A37F' },
  placementDot: {
    position: 'absolute',
    top: -4,
    width: 11,
    height: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 6,
    backgroundColor: '#10A37F',
  },
  placementLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  adMarkerLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  adMarkerText: { color: '#0B7A60', fontSize: 10, fontWeight: '600' },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 13,
    padding: 15,
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  summaryContent: { flex: 1 },
  summaryProduct: { color: '#111111', fontSize: 15, fontWeight: '600' },
  summaryPhrase: { marginTop: 6, color: '#6F6F6B', fontSize: 13, lineHeight: 19 },
  completionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    borderWidth: 1,
    borderColor: '#B8DFD4',
    borderRadius: 14,
    backgroundColor: '#F2FAF7',
  },
  completionIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#10A37F',
  },
  completionText: { flex: 1 },
  completionTitle: { color: '#111111', fontSize: 15, fontWeight: '600' },
  secondaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButtonStrongText: { color: '#111111', fontSize: 14, fontWeight: '600' },
  secondaryButtonText: { color: '#6F6F6B', fontSize: 14, fontWeight: '500' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(247, 247, 245, 0.94)',
  },
  loadingCard: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 34,
    borderWidth: 1,
    borderColor: '#DEDEDA',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  loadingOrb: { alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { marginTop: 22, color: '#111111', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  loadingSubtitle: { marginTop: 8, color: '#6F6F6B', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  pressed: { opacity: 0.64 },
});
