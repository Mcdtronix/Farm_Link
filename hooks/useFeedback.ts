import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../lib/apiConfig';

export interface FeedbackData {
  id: string;
  session: string;
  user_correction?: string;
  feedback_text?: string;
  was_helpful?: boolean;
  created_at: string;
}

export interface PricingFeedbackData {
  id: string;
  session: string;
  actual_price?: number;
  feedback_text?: string;
  was_helpful?: boolean;
  created_at: string;
}

export const useFeedback = () => {
  const { user } = useAuth();

  const getFeedbackByType = async (feedbackType: 'grading' | 'pricing'): Promise<FeedbackData[] | PricingFeedbackData[] | null> => {
    try {
      console.log(`🔍 FRONTEND FEEDBACK LIST:`);
      console.log(`   Feedback Type: ${feedbackType}`);

      const response = await fetch(`${API_BASE_URL}/feedback/${feedbackType}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`📤 FEEDBACK LIST RESPONSE:`);
      console.log(`   Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Feedback list failed');
      }

      const feedbackData = await response.json();
      
      console.log(`✅ FEEDBACK LIST SUCCESS:`);
      console.log(`   Feedback Count: ${feedbackData.length}`);

      return feedbackData;
    } catch (error: any) {
      console.error(`❌ FEEDBACK LIST FAILED: ${error.message}`);
      return null;
    }
  };

  return { getFeedbackByType };
};
