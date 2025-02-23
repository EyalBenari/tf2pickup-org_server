import { Transform, TransformationType } from 'class-transformer';
import { Types } from 'mongoose';

export const TransformObjectId: () => PropertyDecorator =
  () => (target: object, propertyKey: string | symbol) => {
    Transform(({ type, obj }) => {
      switch (type) {
        case TransformationType.PLAIN_TO_CLASS:
          return new Types.ObjectId(obj[propertyKey]);

        case TransformationType.CLASS_TO_PLAIN:
          return obj[propertyKey].toString();

        case TransformationType.CLASS_TO_CLASS:
          return obj[propertyKey];

        default:
          return undefined;
      }
    })(target, propertyKey);
  };
