import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Button,
  Chip,
  ErrorState,
  LoadingState,
  Screen,
  ScreenHeader,
  StarRating,
  Text,
} from '@/components/ui';
import { useOrder, useRateOrder } from '@/features/orders/hooks';
import { colors, radius, spacing, typography } from '@/theme';
import { tell } from '@/ux/dialog';

const POSITIVE_TAGS = ['Crispy as always', 'Right on time', 'Well packed', 'Friendly driver'];
const NEGATIVE_TAGS = ['Arrived cold', 'Late', 'Item missing', 'Wrong order'];

/** Rate Order (brief §4). */
export default function RateOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const order = useOrder(id);
  const rateOrder = useRateOrder();

  /**
   * What the customer has changed, over what the order already says.
   *
   * The order carries a rating and this screen ignored it. Fourteen seeded
   * orders have one, `rateOrder` stores it and the receipt shows it back — and
   * opening this screen for an order already rated drew five empty stars, no
   * tags, an empty comment box and a disabled "Submit rating". Somebody who
   * came to change their mind was shown a form denying they had ever rated it;
   * somebody who came to check what they had said was told nothing.
   *
   * Held as "null until touched" and resolved during render rather than copied
   * into state by an effect. The order arrives asynchronously, so an effect
   * would have to fire on the render after it lands and then never again — a
   * ref and a guard, which the React Compiler correctly refuses ("calling
   * setState synchronously within an effect can trigger cascading renders").
   * Derived, there is no moment when the two disagree: before the customer
   * touches anything the record shows through, and the instant they do, their
   * edit wins for good.
   */
  const [ratingEdit, setRatingEdit] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [commentEdit, setCommentEdit] = useState<string | null>(null);

  const rating = ratingEdit ?? order.data?.rating ?? 0;
  const comment = commentEdit ?? order.data?.ratingComment ?? '';
  const setComment = setCommentEdit;

  const tags = rating >= 4 ? POSITIVE_TAGS : rating > 0 ? NEGATIVE_TAGS : [];

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }, []);

  const handleRatingChange = useCallback((value: number) => {
    setRatingEdit(value);
    // Tag sets differ by sentiment, so clear stale selections on a flip.
    setSelectedTags([]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!order.data || rating === 0) return;

    const fullComment = [selectedTags.join(', '), comment.trim()]
      .filter((part) => part.length > 0)
      .join(' — ');

    /**
     * The service refuses a rating on an order that was cancelled or has not
     * arrived, and this had no catch — so a refusal would have been an
     * unhandled rejection and a button that did nothing. The star picker only
     * offers this on a completed order, but a screen is not a rule and a
     * deep link does not go through the screen.
     */
    try {
      await rateOrder.mutateAsync({
        orderId: order.data.id,
        rating,
        ...(fullComment.length > 0 ? { comment: fullComment } : {}),
      });
    } catch (error) {
      void tell(
        'We could not save that',
        error instanceof Error ? error.message : 'Please try again shortly.',
      );
      return;
    }

    router.replace(`/order/${order.data.id}`);
  }, [order.data, rating, selectedTags, comment, rateOrder, router]);

  if (order.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Rate your order" />
        <LoadingState />
      </Screen>
    );
  }

  if (order.isError || !order.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Rate your order" />
        <ErrorState onRetry={() => void order.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']} testID="rate-order-screen">
      <ScreenHeader title="Rate your order" subtitle={order.data.reference} />

      <View style={styles.body}>
        <View style={styles.ratingBlock}>
          <View style={styles.iconWell}>
            <Ionicons name="restaurant" size={26} color={colors.primary} />
          </View>
          <Text variant="h2" align="center">
            How was it?
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center">
            Your feedback goes straight to {order.data.storeName}.
          </Text>

          <StarRating rating={rating} onChange={handleRatingChange} testID="rate-stars" />
        </View>

        {tags.length > 0 ? (
          <View style={styles.tagBlock}>
            <Text variant="h3">{rating >= 4 ? 'What went well?' : 'What went wrong?'}</Text>
            <View style={styles.tagRow}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  selected={selectedTags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {rating > 0 ? (
          <View style={styles.commentBlock}>
            <Text variant="h3">Anything else?</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Optional — tell us more"
              placeholderTextColor={colors.textDisabled}
              multiline
              maxLength={300}
              style={styles.comment}
              accessibilityLabel="Additional comments"
              testID="rate-comment"
            />
          </View>
        ) : null}

        <Button
          /*
            "Submit" is the wrong word for a rating that already exists. The
            screen is reached from a receipt that shows the stars, so somebody
            arriving here has either come to change their mind or to check what
            they said — and being offered "Submit rating" over their own answer
            reads as though it had never been recorded.
          */
          label={order.data.rating ? 'Update rating' : 'Submit rating'}
          onPress={() => void handleSubmit()}
          disabled={rating === 0}
          loading={rateOrder.isPending}
          size="lg"
          testID="rate-submit"
        />
        <Button label="Not now" onPress={() => router.back()} variant="text" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  ratingBlock: { alignItems: 'center', gap: spacing.md },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  tagBlock: { gap: spacing.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  commentBlock: { gap: spacing.sm },
  comment: {
    minHeight: 100,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
    ...typography.body,
    color: colors.textPrimary,
  },
});
